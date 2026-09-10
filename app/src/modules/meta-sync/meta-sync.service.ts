import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { db } from '../../config/prisma.js';
import { env } from '../../config/env.js';
import { AppError } from '../../utils/helpers/app-error.js';
import {
  addDaysToDateString,
  minDateString,
  nowIso,
  toTimestamptzString,
  toZonedDateString,
} from '../../utils/helpers/date.js';
import { logger } from '../../utils/helpers/logger.js';
import { parseDto } from '../../utils/helpers/parse-dto.js';
import { getFixturePath } from '../../utils/helpers/paths.js';
import { MetaEntityStatus, SyncEntityType, SyncRunStatus } from '../../utils/constants/enums.js';
import { createMetaAdsClient } from '../../services/meta-ads/index.js';
import {
  mapAccount,
  mapAd,
  mapAdSet,
  mapCampaign,
  mapInsightRow,
  mapMetaStatus,
} from '../../services/meta-ads/meta-ads.mapper.js';
import {
  fixtureCampaignRenameSchema,
  type FixtureCampaignRename,
  type MappedAccount,
  type MappedAd,
  type MappedAdSet,
  type MappedCampaign,
  type MappedInsightRow,
} from '../../services/meta-ads/meta-ads.types.js';
import type {
  HierarchySyncSummary,
  InsightsSyncSummary,
  SyncRunView,
  SyncStatusView,
  SyncSummary,
} from './types/meta-sync.types.js';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

type PrismaOrm = typeof db.orm;

interface VersionSnapshot {
  readonly name: string;
  readonly status: MetaEntityStatus;
  readonly effectiveStatus: MetaEntityStatus;
}

interface AccountRecord {
  readonly id: string;
  readonly timezoneName: string;
}

interface AdLookupRow {
  readonly id: string;
  readonly campaignId: string;
  readonly adSetId: string;
}

interface InsightsWindow {
  readonly windowStart: string;
  readonly windowEnd: string;
}

type VersionEntityKind = 'campaign' | 'adSet' | 'ad';

interface CurrentVersionRow {
  readonly id: string;
  readonly name: string;
  readonly status: string;
  readonly effectiveStatus: string;
}

// [WHY] single-process backend — overlapping POST /api/sync/run would double-write SyncRun rows
let syncInFlight = false;

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Runs hierarchy sync then insights sync against the configured Meta source.
 *
 * @returns Counts and windows from both steps
 * @throws {AppError} if a sync is already running
 */
export async function runFullSync(): Promise<SyncSummary> {
  if (syncInFlight) {
    throw new AppError('A sync is already running', 409);
  }

  syncInFlight = true;
  try {
    const hierarchy = await syncHierarchy();
    const insights = await syncInsights();
    return { hierarchy, insights };
  } finally {
    syncInFlight = false;
  }
}

/**
 * Returns the latest cursor, insight count, and most recent sync runs.
 *
 * @returns Status payload for GET /api/sync/status
 */
export async function getSyncStatus(): Promise<SyncStatusView> {
  const cursor = await db.orm.public.SyncCursor.orderBy((row) => row.updatedAt.desc()).first();
  const insightCount = await db.orm.public.AdInsightDaily.aggregate((aggregate) => ({
    total: aggregate.count(),
  }));
  const lastHierarchyRun = await latestRun(SyncEntityType.HIERARCHY);
  const lastInsightsRun = await latestRun(SyncEntityType.INSIGHTS);

  return {
    dataSource: env.META_DATA_SOURCE,
    lastSuccessfulSyncAt: cursor?.lastSuccessfulSyncAt ?? null,
    lastSyncedThroughDate: cursor?.lastSyncedThroughDate ?? null,
    insightRowCount: insightCount.total,
    lastHierarchyRun,
    lastInsightsRun,
  };
}

// ============================================================================
// HIERARCHY SYNC
// ============================================================================

/**
 * Upserts campaigns, ad sets, and ads, then writes SCD2 version rows.
 *
 * @returns Hierarchy sync summary
 */
async function syncHierarchy(): Promise<HierarchySyncSummary> {
  const runId = randomUUID();
  const startedAt = nowIso();
  await db.orm.public.SyncRun.create({
    id: runId,
    entityType: SyncEntityType.HIERARCHY,
    status: SyncRunStatus.RUNNING,
    windowStart: null,
    windowEnd: null,
    rowsUpserted: 0,
    errorMessage: null,
    startedAt,
    finishedAt: null,
  });

  try {
    const client = createMetaAdsClient();
    const account = mapAccount(await client.getAccount());
    const adAccount = await upsertAdAccount(account);
    const observedAt = nowIso();

    const campaigns = (await client.getCampaigns()).map(mapCampaign);
    const adSets = (await client.getAdSets()).map(mapAdSet);
    const ads = (await client.getAds()).map(mapAd);

    for (const campaign of campaigns) {
      await db.transaction(async (tx) => {
        await upsertCampaign(tx.orm, campaign, adAccount.id, observedAt);
      });
    }

    if (env.META_DATA_SOURCE === 'fixtures') {
      await applyFixtureCampaignRename();
    }

    for (const adSet of adSets) {
      await db.transaction(async (tx) => {
        await upsertAdSet(tx.orm, adSet, observedAt);
      });
    }

    for (const ad of ads) {
      await db.transaction(async (tx) => {
        await upsertAd(tx.orm, ad, observedAt);
      });
    }

    const rowsUpserted = campaigns.length + adSets.length + ads.length;
    await finishSyncRun(runId, SyncRunStatus.SUCCESS, rowsUpserted, null);

    logger.info('hierarchy sync complete', {
      campaigns: campaigns.length,
      adSets: adSets.length,
      ads: ads.length,
    });

    return {
      entityType: 'HIERARCHY',
      status: 'SUCCESS',
      rowsUpserted,
      campaigns: campaigns.length,
      adSets: adSets.length,
      ads: ads.length,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Hierarchy sync failed';
    await finishSyncRun(runId, SyncRunStatus.FAILED, 0, message);
    throw error;
  }
}

/**
 * Inserts or updates the ad account row keyed by Meta's act_ id.
 *
 * @param account - Mapped account
 * @returns Persisted account id and timezone
 */
async function upsertAdAccount(account: MappedAccount): Promise<AccountRecord> {
  const existing = await db.orm.public.AdAccount.where({
    metaAdAccountId: account.metaAdAccountId,
  }).first();
  const observedAt = nowIso();

  if (existing === null) {
    const created = await db.orm.public.AdAccount.create({
      id: randomUUID(),
      metaAdAccountId: account.metaAdAccountId,
      name: account.name,
      currency: account.currency,
      timezoneName: account.timezoneName,
      createdAt: observedAt,
      updatedAt: observedAt,
    });
    return { id: created.id, timezoneName: created.timezoneName };
  }

  await db.orm.public.AdAccount.where({ id: existing.id }).update({
    name: account.name,
    currency: account.currency,
    timezoneName: account.timezoneName,
    updatedAt: observedAt,
  });

  return { id: existing.id, timezoneName: account.timezoneName };
}

/**
 * Upserts a campaign entity and its current SCD2 version inside a transaction.
 *
 * @param orm - Prisma ORM (root or transaction)
 * @param campaign - Mapped campaign
 * @param adAccountId - Internal ad account id
 * @param observedAt - Sync observation timestamp
 * @returns void
 */
async function upsertCampaign(
  orm: PrismaOrm,
  campaign: MappedCampaign,
  adAccountId: string,
  observedAt: string,
): Promise<void> {
  const existing = await orm.public.Campaign.where({
    metaCampaignId: campaign.metaCampaignId,
  }).first();

  if (existing === null) {
    const created = await orm.public.Campaign.create({
      id: randomUUID(),
      metaCampaignId: campaign.metaCampaignId,
      adAccountId,
      objective: campaign.objective,
      currentName: campaign.name,
      currentStatus: campaign.status,
      metaCreatedTime: campaign.createdTime,
      createdAt: observedAt,
      updatedAt: observedAt,
    });
    await orm.public.CampaignVersion.create({
      id: randomUUID(),
      campaignId: created.id,
      name: campaign.name,
      status: campaign.status,
      effectiveStatus: campaign.effectiveStatus,
      validFrom: observedAt,
      validTo: null,
    });
    return;
  }

  await orm.public.Campaign.where({ id: existing.id }).update({
    objective: campaign.objective,
    currentName: campaign.name,
    currentStatus: campaign.status,
    metaCreatedTime: campaign.createdTime,
    updatedAt: observedAt,
  });

  await applyVersionChange(orm, 'campaign', existing.id, {
    name: campaign.name,
    status: campaign.status,
    effectiveStatus: campaign.effectiveStatus,
  }, observedAt);
}

/**
 * Upserts an ad set entity after resolving its parent campaign.
 *
 * @param orm - Prisma ORM
 * @param adSet - Mapped ad set
 * @param observedAt - Sync observation timestamp
 * @returns void
 */
async function upsertAdSet(orm: PrismaOrm, adSet: MappedAdSet, observedAt: string): Promise<void> {
  const campaign = await orm.public.Campaign.where({
    metaCampaignId: adSet.metaCampaignId,
  }).first();
  if (campaign === null) {
    logger.warn('skipping ad set with unknown campaign', {
      metaAdSetId: adSet.metaAdSetId,
      metaCampaignId: adSet.metaCampaignId,
    });
    return;
  }

  const existing = await orm.public.AdSet.where({ metaAdSetId: adSet.metaAdSetId }).first();
  if (existing === null) {
    const created = await orm.public.AdSet.create({
      id: randomUUID(),
      metaAdSetId: adSet.metaAdSetId,
      campaignId: campaign.id,
      currentName: adSet.name,
      currentStatus: adSet.status,
      optimizationGoal: adSet.optimizationGoal,
      billingEvent: adSet.billingEvent,
      dailyBudget: adSet.dailyBudget,
      lifetimeBudget: adSet.lifetimeBudget,
      metaCreatedTime: adSet.createdTime,
      createdAt: observedAt,
      updatedAt: observedAt,
    });
    await orm.public.AdSetVersion.create({
      id: randomUUID(),
      adSetId: created.id,
      name: adSet.name,
      status: adSet.status,
      effectiveStatus: adSet.effectiveStatus,
      validFrom: observedAt,
      validTo: null,
    });
    return;
  }

  await orm.public.AdSet.where({ id: existing.id }).update({
    campaignId: campaign.id,
    currentName: adSet.name,
    currentStatus: adSet.status,
    optimizationGoal: adSet.optimizationGoal,
    billingEvent: adSet.billingEvent,
    dailyBudget: adSet.dailyBudget,
    lifetimeBudget: adSet.lifetimeBudget,
    metaCreatedTime: adSet.createdTime,
    updatedAt: observedAt,
  });

  await applyVersionChange(orm, 'adSet', existing.id, {
    name: adSet.name,
    status: adSet.status,
    effectiveStatus: adSet.effectiveStatus,
  }, observedAt);
}

/**
 * Upserts an ad entity after resolving its parent ad set and campaign.
 *
 * @param orm - Prisma ORM
 * @param ad - Mapped ad
 * @param observedAt - Sync observation timestamp
 * @returns void
 */
async function upsertAd(orm: PrismaOrm, ad: MappedAd, observedAt: string): Promise<void> {
  const adSet = await orm.public.AdSet.where({ metaAdSetId: ad.metaAdSetId }).first();
  const campaign = await orm.public.Campaign.where({
    metaCampaignId: ad.metaCampaignId,
  }).first();
  if (adSet === null || campaign === null) {
    logger.warn('skipping ad with unknown parent', {
      metaAdId: ad.metaAdId,
      metaAdSetId: ad.metaAdSetId,
      metaCampaignId: ad.metaCampaignId,
    });
    return;
  }

  const existing = await orm.public.Ad.where({ metaAdId: ad.metaAdId }).first();
  if (existing === null) {
    const created = await orm.public.Ad.create({
      id: randomUUID(),
      metaAdId: ad.metaAdId,
      adSetId: adSet.id,
      campaignId: campaign.id,
      currentName: ad.name,
      currentStatus: ad.status,
      creativeMetaId: ad.creativeMetaId,
      metaCreatedTime: ad.createdTime,
      createdAt: observedAt,
      updatedAt: observedAt,
    });
    await orm.public.AdVersion.create({
      id: randomUUID(),
      adId: created.id,
      name: ad.name,
      status: ad.status,
      effectiveStatus: ad.effectiveStatus,
      validFrom: observedAt,
      validTo: null,
    });
    return;
  }

  await orm.public.Ad.where({ id: existing.id }).update({
    adSetId: adSet.id,
    campaignId: campaign.id,
    currentName: ad.name,
    currentStatus: ad.status,
    creativeMetaId: ad.creativeMetaId,
    metaCreatedTime: ad.createdTime,
    updatedAt: observedAt,
  });

  await applyVersionChange(orm, 'ad', existing.id, {
    name: ad.name,
    status: ad.status,
    effectiveStatus: ad.effectiveStatus,
  }, observedAt);
}

/**
 * Closes the current SCD2 version and opens a new one when name or status changed.
 *
 * @param orm - Prisma ORM
 * @param kind - Which version table to write
 * @param parentId - Internal entity id
 * @param next - Newly observed name/status
 * @param observedAt - Sync observation timestamp
 * @returns void
 */
async function applyVersionChange(
  orm: PrismaOrm,
  kind: VersionEntityKind,
  parentId: string,
  next: VersionSnapshot,
  observedAt: string,
): Promise<void> {
  // [WHY] version bounds are our sync observation time; Meta does not expose the real rename timestamp
  const current = await findCurrentVersion(orm, kind, parentId);
  if (current === null) {
    await insertVersion(orm, kind, parentId, next, observedAt, null);
    return;
  }

  const unchanged =
    current.name === next.name &&
    current.status === next.status &&
    current.effectiveStatus === next.effectiveStatus;
  if (unchanged) {
    return;
  }

  await closeVersion(orm, kind, current.id, observedAt);
  await insertVersion(orm, kind, parentId, next, observedAt, null);
}

/**
 * Finds the open SCD2 row (validTo IS NULL) for an entity.
 *
 * @param orm - Prisma ORM
 * @param kind - Entity kind
 * @param parentId - Internal entity id
 * @returns Open version, or null
 */
async function findCurrentVersion(
  orm: PrismaOrm,
  kind: VersionEntityKind,
  parentId: string,
): Promise<CurrentVersionRow | null> {
  if (kind === 'campaign') {
    const row = await orm.public.CampaignVersion.where({
      campaignId: parentId,
      validTo: null,
    }).first();
    return row === null ? null : toCurrentVersionRow(row);
  }
  if (kind === 'adSet') {
    const row = await orm.public.AdSetVersion.where({
      adSetId: parentId,
      validTo: null,
    }).first();
    return row === null ? null : toCurrentVersionRow(row);
  }
  const row = await orm.public.AdVersion.where({ adId: parentId, validTo: null }).first();
  return row === null ? null : toCurrentVersionRow(row);
}

/**
 * Narrows a version row to the fields SCD2 compares.
 *
 * @param row - Version table row
 * @returns Snapshot used for change detection
 */
function toCurrentVersionRow(row: CurrentVersionRow): CurrentVersionRow {
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    effectiveStatus: row.effectiveStatus,
  };
}

/**
 * Sets validTo on the open version row.
 *
 * @param orm - Prisma ORM
 * @param kind - Entity kind
 * @param versionId - Version row id
 * @param observedAt - Close timestamp
 * @returns void
 */
async function closeVersion(
  orm: PrismaOrm,
  kind: VersionEntityKind,
  versionId: string,
  observedAt: string,
): Promise<void> {
  if (kind === 'campaign') {
    await orm.public.CampaignVersion.where({ id: versionId }).update({ validTo: observedAt });
    return;
  }
  if (kind === 'adSet') {
    await orm.public.AdSetVersion.where({ id: versionId }).update({ validTo: observedAt });
    return;
  }
  await orm.public.AdVersion.where({ id: versionId }).update({ validTo: observedAt });
}

/**
 * Inserts a new SCD2 version row.
 *
 * @param orm - Prisma ORM
 * @param kind - Entity kind
 * @param parentId - Internal entity id
 * @param snapshot - Name/status for this period
 * @param validFrom - Period start
 * @param validTo - Period end, or null if current
 * @returns void
 */
async function insertVersion(
  orm: PrismaOrm,
  kind: VersionEntityKind,
  parentId: string,
  snapshot: VersionSnapshot,
  validFrom: string,
  validTo: string | null,
): Promise<void> {
  if (kind === 'campaign') {
    await orm.public.CampaignVersion.create({
      id: randomUUID(),
      campaignId: parentId,
      name: snapshot.name,
      status: snapshot.status,
      effectiveStatus: snapshot.effectiveStatus,
      validFrom,
      validTo,
    });
    return;
  }
  if (kind === 'adSet') {
    await orm.public.AdSetVersion.create({
      id: randomUUID(),
      adSetId: parentId,
      name: snapshot.name,
      status: snapshot.status,
      effectiveStatus: snapshot.effectiveStatus,
      validFrom,
      validTo,
    });
    return;
  }
  await orm.public.AdVersion.create({
    id: randomUUID(),
    adId: parentId,
    name: snapshot.name,
    status: snapshot.status,
    effectiveStatus: snapshot.effectiveStatus,
    validFrom,
    validTo,
  });
}

/**
 * Seeds the documented fixture rename so Query 3 sees two names on first sync.
 *
 * @returns void
 */
async function applyFixtureCampaignRename(): Promise<void> {
  const raw: unknown = JSON.parse(await readFile(getFixturePath('campaign-rename.json'), 'utf8'));
  const rename: FixtureCampaignRename = parseDto(
    fixtureCampaignRenameSchema,
    raw,
    'fixtures/campaign-rename.json',
  );

  const campaign = await db.orm.public.Campaign.where({
    metaCampaignId: rename.meta_campaign_id,
  }).first();
  if (campaign === null) {
    logger.warn('fixture rename skipped, campaign missing', {
      metaCampaignId: rename.meta_campaign_id,
    });
    return;
  }

  const existing = await db.orm.public.CampaignVersion.where({ campaignId: campaign.id }).all();
  const existingNames = new Set(existing.map((row) => row.name));

  for (const period of rename.names) {
    const validFrom = toTimestamptzString(period.valid_from);
    const validTo = period.valid_to === null ? null : toTimestamptzString(period.valid_to);
    const status = mapMetaStatus(period.status);
    const effectiveStatus = mapMetaStatus(period.effective_status);
    const match = existing.find((row) => row.name === period.name);

    if (match !== undefined) {
      await db.orm.public.CampaignVersion.where({ id: match.id }).update({
        status,
        effectiveStatus,
        validFrom,
        validTo,
      });
      continue;
    }

    if (!existingNames.has(period.name)) {
      await db.orm.public.CampaignVersion.create({
        id: randomUUID(),
        campaignId: campaign.id,
        name: period.name,
        status,
        effectiveStatus,
        validFrom,
        validTo,
      });
    }
  }
}

// ============================================================================
// INSIGHTS SYNC
// ============================================================================

/**
 * Fetches the catch-up + 28-day restatement window and upserts daily ad rows.
 *
 * @returns Insights sync summary
 */
async function syncInsights(): Promise<InsightsSyncSummary> {
  const runId = randomUUID();
  const startedAt = nowIso();
  await db.orm.public.SyncRun.create({
    id: runId,
    entityType: SyncEntityType.INSIGHTS,
    status: SyncRunStatus.RUNNING,
    windowStart: null,
    windowEnd: null,
    rowsUpserted: 0,
    errorMessage: null,
    startedAt,
    finishedAt: null,
  });

  try {
    const client = createMetaAdsClient();
    const account = mapAccount(await client.getAccount());
    const adAccount = await upsertAdAccount(account);
    const window = await resolveInsightsWindow(adAccount);
    const rawRows = await client.getDailyInsights(window.windowStart, window.windowEnd);
    const rows = rawRows.map(mapInsightRow);

    let rowsUpserted = 0;
    let skippedMissingAds = 0;
    const syncedAt = nowIso();

    for (const row of rows) {
      const ad = await findAdLookup(row.metaAdId);
      if (ad === null) {
        skippedMissingAds += 1;
        logger.warn('skipping insight row for unknown ad', { metaAdId: row.metaAdId, date: row.date });
        continue;
      }
      await upsertInsightRow(ad, row, syncedAt);
      rowsUpserted += 1;
    }

    await db.orm.public.SyncCursor.where({ adAccountId: adAccount.id }).update({
      lastSuccessfulSyncAt: syncedAt,
      lastSyncedThroughDate: window.windowEnd,
      updatedAt: syncedAt,
    });

    await db.orm.public.SyncRun.where({ id: runId }).update({
      status: SyncRunStatus.SUCCESS,
      windowStart: window.windowStart,
      windowEnd: window.windowEnd,
      rowsUpserted,
      errorMessage: null,
      finishedAt: nowIso(),
    });

    logger.info('insights sync complete', {
      rowsUpserted,
      skippedMissingAds,
      windowStart: window.windowStart,
      windowEnd: window.windowEnd,
    });

    return {
      entityType: 'INSIGHTS',
      status: 'SUCCESS',
      rowsUpserted,
      skippedMissingAds,
      windowStart: window.windowStart,
      windowEnd: window.windowEnd,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Insights sync failed';
    await finishSyncRun(runId, SyncRunStatus.FAILED, 0, message);
    throw error;
  }
}

/**
 * Computes the fetch window: last 28 days, extended backward if the cursor is stale.
 *
 * @param adAccount - Persisted ad account
 * @returns Inclusive YYYY-MM-DD window
 */
async function resolveInsightsWindow(adAccount: AccountRecord): Promise<InsightsWindow> {
  const lookback = env.META_INSIGHTS_LOOKBACK_DAYS;
  const today = toZonedDateString(new Date(), adAccount.timezoneName);
  const defaultStart = addDaysToDateString(today, -lookback);

  let cursor = await db.orm.public.SyncCursor.where({ adAccountId: adAccount.id }).first();
  if (cursor === null) {
    const createdAt = nowIso();
    cursor = await db.orm.public.SyncCursor.create({
      id: randomUUID(),
      adAccountId: adAccount.id,
      lastSuccessfulSyncAt: null,
      lastSyncedThroughDate: defaultStart,
      updatedAt: createdAt,
    });
  }

  const catchUpStart = addDaysToDateString(cursor.lastSyncedThroughDate, -lookback);
  const windowStart = minDateString(catchUpStart, defaultStart);

  return { windowStart, windowEnd: today };
}

/**
 * Looks up the internal ad/campaign/ad-set ids for a Meta ad id.
 *
 * @param metaAdId - Meta ad id from the insights payload
 * @returns Lookup row, or null if hierarchy sync has not seen the ad
 */
async function findAdLookup(metaAdId: string): Promise<AdLookupRow | null> {
  const ad = await db.orm.public.Ad.where({ metaAdId }).first();
  if (ad === null) {
    return null;
  }
  return { id: ad.id, campaignId: ad.campaignId, adSetId: ad.adSetId };
}

/**
 * Upserts one daily insight row on the (adId, date) uniqueness key.
 *
 * @param ad - Internal ad lookup
 * @param row - Mapped insight
 * @param syncedAt - Write timestamp
 * @returns void
 */
async function upsertInsightRow(
  ad: AdLookupRow,
  row: MappedInsightRow,
  syncedAt: string,
): Promise<void> {
  const existing = await db.orm.public.AdInsightDaily.where({
    adId: ad.id,
    date: row.date,
  }).first();

  if (existing === null) {
    await db.orm.public.AdInsightDaily.create({
      id: randomUUID(),
      adId: ad.id,
      campaignId: ad.campaignId,
      adSetId: ad.adSetId,
      date: row.date,
      impressions: row.impressions,
      clicks: row.clicks,
      spend: row.spend,
      purchases: row.purchases,
      purchaseValue: row.purchaseValue,
      attributionWindows: env.META_ATTRIBUTION_WINDOWS,
      rawActionsJson: row.rawActionsJson,
      syncedAt,
      createdAt: syncedAt,
      updatedAt: syncedAt,
    });
    return;
  }

  await db.orm.public.AdInsightDaily.where({ id: existing.id }).update({
    campaignId: ad.campaignId,
    adSetId: ad.adSetId,
    impressions: row.impressions,
    clicks: row.clicks,
    spend: row.spend,
    purchases: row.purchases,
    purchaseValue: row.purchaseValue,
    attributionWindows: env.META_ATTRIBUTION_WINDOWS,
    rawActionsJson: row.rawActionsJson,
    syncedAt,
    updatedAt: syncedAt,
  });
}

// ============================================================================
// SYNC RUN HELPERS
// ============================================================================

/**
 * Marks a SyncRun finished.
 *
 * @param runId - SyncRun id
 * @param status - Terminal status
 * @param rowsUpserted - Rows written
 * @param errorMessage - Failure message, or null
 * @returns void
 */
async function finishSyncRun(
  runId: string,
  status: SyncRunStatus,
  rowsUpserted: number,
  errorMessage: string | null,
): Promise<void> {
  await db.orm.public.SyncRun.where({ id: runId }).update({
    status,
    rowsUpserted,
    errorMessage,
    finishedAt: nowIso(),
  });
}

/**
 * Loads the most recent sync run for one entity type.
 *
 * @param entityType - HIERARCHY or INSIGHTS
 * @returns View model, or null if none exist
 */
async function latestRun(entityType: SyncEntityType): Promise<SyncRunView | null> {
  const row = await db.orm.public.SyncRun.where({ entityType })
    .orderBy((run) => run.startedAt.desc())
    .first();
  if (row === null) {
    return null;
  }
  return {
    id: row.id,
    entityType: row.entityType,
    status: row.status,
    rowsUpserted: row.rowsUpserted,
    windowStart: row.windowStart,
    windowEnd: row.windowEnd,
    errorMessage: row.errorMessage,
    startedAt: row.startedAt,
    finishedAt: row.finishedAt,
  };
}
