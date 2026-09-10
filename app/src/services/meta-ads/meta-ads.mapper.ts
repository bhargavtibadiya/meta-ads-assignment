import type { JsonValue } from '@prisma/orm-postgres/target/codec-types';
import { MetaEntityStatus, META_ENTITY_STATUS_VALUES } from '../../utils/constants/enums.js';
import { PURCHASE_ACTION_TYPES } from '../../utils/constants/sync.js';
import { toTimestamptzString } from '../../utils/helpers/date.js';
import type {
  MappedAccount,
  MappedAd,
  MappedAdSet,
  MappedCampaign,
  MappedInsightRow,
  RawMetaAccount,
  RawMetaAction,
  RawMetaAd,
  RawMetaAdSet,
  RawMetaCampaign,
  RawMetaInsightRow,
} from './meta-ads.types.js';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface JsonObjectBuilder {
  [key: string]: JsonValue;
}

/**
 * Maps a Meta status string onto our enum, falling back to UNKNOWN.
 *
 * @param value - Status from Meta or fixtures
 * @returns Known MetaEntityStatus, or UNKNOWN
 */
export function mapMetaStatus(value: string): MetaEntityStatus {
  const match = META_ENTITY_STATUS_VALUES.find((status) => status === value);
  return match ?? MetaEntityStatus.UNKNOWN;
}

/**
 * Reads the first matching action_type from a Meta actions array.
 *
 * @param actions - Meta `actions` or `action_values` array
 * @param candidateTypes - Action types to try, in priority order
 * @returns Numeric value of the first match, or 0
 */
export function extractActionValue(
  actions: readonly RawMetaAction[] | undefined,
  candidateTypes: readonly string[],
): number {
  if (actions === undefined) {
    return 0;
  }

  for (const candidate of candidateTypes) {
    const match = actions.find((action) => action.action_type === candidate);
    if (match !== undefined) {
      const parsed = Number(match.value);
      return Number.isFinite(parsed) ? parsed : 0;
    }
  }

  return 0;
}

/**
 * Converts Meta budget minor units (cents) to a major-unit decimal string.
 *
 * @param value - Minor-unit amount from the Graph API, or null
 * @returns Decimal string in account currency units, or null
 */
export function minorUnitsToMajor(value: string | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return (parsed / 100).toFixed(6);
}

/**
 * Maps a raw Meta ad account payload into the internal account shape.
 *
 * @param account - Validated Graph API / fixture account
 * @returns Mapped account
 */
export function mapAccount(account: RawMetaAccount): MappedAccount {
  return {
    metaAdAccountId: account.id,
    name: account.name,
    currency: account.currency,
    timezoneName: account.timezone_name,
  };
}

/**
 * Maps a raw Meta campaign payload into the internal campaign shape.
 *
 * @param campaign - Validated Graph API / fixture campaign
 * @returns Mapped campaign
 */
export function mapCampaign(campaign: RawMetaCampaign): MappedCampaign {
  return {
    metaCampaignId: campaign.id,
    name: campaign.name,
    status: mapMetaStatus(campaign.status),
    effectiveStatus: mapMetaStatus(campaign.effective_status),
    objective: campaign.objective ?? null,
    createdTime: optionalTimestamp(campaign.created_time),
  };
}

/**
 * Maps a raw Meta ad set payload into the internal ad set shape.
 *
 * @param adSet - Validated Graph API / fixture ad set
 * @returns Mapped ad set
 */
export function mapAdSet(adSet: RawMetaAdSet): MappedAdSet {
  return {
    metaAdSetId: adSet.id,
    metaCampaignId: adSet.campaign_id,
    name: adSet.name,
    status: mapMetaStatus(adSet.status),
    effectiveStatus: mapMetaStatus(adSet.effective_status),
    optimizationGoal: adSet.optimization_goal ?? null,
    billingEvent: adSet.billing_event ?? null,
    dailyBudget: minorUnitsToMajor(adSet.daily_budget),
    lifetimeBudget: minorUnitsToMajor(adSet.lifetime_budget),
    createdTime: optionalTimestamp(adSet.created_time),
  };
}

/**
 * Maps a raw Meta ad payload into the internal ad shape.
 *
 * @param ad - Validated Graph API / fixture ad
 * @returns Mapped ad
 */
export function mapAd(ad: RawMetaAd): MappedAd {
  return {
    metaAdId: ad.id,
    metaAdSetId: ad.adset_id,
    metaCampaignId: ad.campaign_id,
    name: ad.name,
    status: mapMetaStatus(ad.status),
    effectiveStatus: mapMetaStatus(ad.effective_status),
    creativeMetaId: ad.creative?.id ?? null,
    createdTime: optionalTimestamp(ad.created_time),
  };
}

/**
 * Maps a raw Meta insight row into the internal daily fact shape.
 *
 * @param row - Validated Graph API / fixture insight row
 * @returns Mapped insight row
 */
export function mapInsightRow(row: RawMetaInsightRow): MappedInsightRow {
  const actions = row.actions ?? [];
  const actionValues = row.action_values ?? [];
  const purchaseCount = extractActionValue(actions, PURCHASE_ACTION_TYPES);
  const purchaseValue = extractActionValue(actionValues, PURCHASE_ACTION_TYPES);

  return {
    metaAdId: row.ad_id,
    metaAdSetId: row.adset_id,
    metaCampaignId: row.campaign_id,
    date: row.date_start,
    impressions: toNonNegativeInt(row.impressions),
    clicks: toNonNegativeInt(row.clicks),
    spend: toDecimalString(row.spend),
    purchases: Math.trunc(purchaseCount),
    purchaseValue: toDecimalString(String(purchaseValue)),
    rawActionsJson: actionsToJsonValue(actions, actionValues),
  };
}

/**
 * Converts Meta action arrays into a Prisma Jsonb-compatible value.
 *
 * @param actions - Count-side actions
 * @param actionValues - Value-side actions
 * @returns Jsonb payload
 */
function actionsToJsonValue(
  actions: readonly RawMetaAction[],
  actionValues: readonly RawMetaAction[],
): JsonValue {
  const payload: JsonObjectBuilder = {
    actions: actions.map(actionToJsonValue),
    action_values: actionValues.map(actionToJsonValue),
  };
  return payload;
}

/**
 * Converts one Meta action object into a Jsonb-compatible value.
 *
 * @param action - Single action_type/value pair
 * @returns Json object
 */
function actionToJsonValue(action: RawMetaAction): JsonValue {
  const payload: JsonObjectBuilder = {
    action_type: action.action_type,
    value: action.value,
  };
  return payload;
}

/**
 * Parses an optional Meta created_time into an ISO timestamptz.
 *
 * @param value - Raw timestamp or null/undefined
 * @returns ISO string or null
 */
function optionalTimestamp(value: string | null | undefined): string | null {
  if (value === null || value === undefined || value.length === 0) {
    return null;
  }
  return toTimestamptzString(value);
}

/**
 * Parses a numeric string into a non-negative integer.
 *
 * @param value - Raw integer-like string
 * @returns Truncated non-negative integer
 */
function toNonNegativeInt(value: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }
  return Math.trunc(parsed);
}

/**
 * Normalizes a numeric string into a decimal string Prisma Numeric accepts.
 *
 * @param value - Raw decimal-like string
 * @returns Decimal string, defaulting to 0
 */
function toDecimalString(value: string): string {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return '0';
  }
  return parsed.toFixed(6);
}
