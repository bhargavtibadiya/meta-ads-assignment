import { readFile } from 'node:fs/promises';
import { z } from 'zod';
import { env } from '../../config/env.js';
import {
  META_INSIGHTS_PAGE_LIMIT,
  META_LIST_PAGE_LIMIT,
  META_MAX_RETRIES,
  META_RATE_LIMIT_ERROR_CODES,
} from '../../utils/constants/sync.js';
import { logger } from '../../utils/helpers/logger.js';
import { parseDto } from '../../utils/helpers/parse-dto.js';
import { getFixturePath } from '../../utils/helpers/paths.js';
import type {
  MetaAdsClient,
  MetaListResponse,
  RawMetaAccount,
  RawMetaAd,
  RawMetaAdSet,
  RawMetaCampaign,
  RawMetaInsightRow,
} from './meta-ads.types.js';
import {
  metaListSchema,
  rawMetaAccountSchema,
  rawMetaAdSchema,
  rawMetaAdSetSchema,
  rawMetaCampaignSchema,
  rawMetaInsightRowSchema,
} from './meta-ads.types.js';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface GraphErrorBody {
  readonly message: string;
  readonly code: number;
}

interface FetchJsonResult {
  readonly status: number;
  readonly body: unknown;
}

interface GraphQueryParams {
  readonly [key: string]: string;
}

// ============================================================================
// PUBLIC FACTORY
// ============================================================================

/**
 * Builds the Meta Ads client for the configured data source.
 *
 * @returns A client with the same methods for live Graph API and fixtures
 */
export function createMetaAdsClient(): MetaAdsClient {
  if (env.META_DATA_SOURCE === 'fixtures') {
    return createFixturesClient();
  }
  return createLiveClient();
}

// ============================================================================
// FIXTURES CLIENT
// ============================================================================

/**
 * Reads Graph-shaped JSON from disk. Insights are filtered by the requested
 * date window so the sync's 28-day math is exercised the same way as live mode.
 *
 * @returns Fixture-backed Meta Ads client
 */
function createFixturesClient(): MetaAdsClient {
  return {
    async getAccount(): Promise<RawMetaAccount> {
      const raw = await readJsonFile(getFixturePath('account.json'));
      return parseDto(rawMetaAccountSchema, raw, 'fixtures/account.json');
    },

    async getCampaigns(): Promise<RawMetaCampaign[]> {
      return readFixtureList('campaigns.json', rawMetaCampaignSchema);
    },

    async getAdSets(): Promise<RawMetaAdSet[]> {
      return readFixtureList('adsets.json', rawMetaAdSetSchema);
    },

    async getAds(): Promise<RawMetaAd[]> {
      return readFixtureList('ads.json', rawMetaAdSchema);
    },

    async getDailyInsights(sinceDate: string, untilDate: string): Promise<RawMetaInsightRow[]> {
      const rows = await readFixtureList('insights.json', rawMetaInsightRowSchema);
      return rows.filter((row) => row.date_start >= sinceDate && row.date_start <= untilDate);
    },
  };
}

/**
 * Reads a `{ data: T[] }` fixture file and validates every row.
 *
 * @param fileName - File under app/fixtures
 * @param itemSchema - Zod schema for each row
 * @returns Validated rows
 */
async function readFixtureList<T>(fileName: string, itemSchema: z.ZodType<T>): Promise<T[]> {
  const raw = await readJsonFile(getFixturePath(fileName));
  const parsed = parseDto(metaListSchema(itemSchema), raw, `fixtures/${fileName}`);
  return parsed.data;
}

/**
 * Reads a JSON file as unknown for Zod validation at the boundary.
 *
 * @param filePath - Absolute path
 * @returns Parsed JSON value
 */
async function readJsonFile(filePath: string): Promise<unknown> {
  const text = await readFile(filePath, 'utf8');
  return JSON.parse(text);
}

// ============================================================================
// LIVE GRAPH API CLIENT
// ============================================================================

/**
 * Calls the Meta Marketing API with pagination and rate-limit retries.
 *
 * @returns Live Graph API client
 */
function createLiveClient(): MetaAdsClient {
  const accountId = env.META_AD_ACCOUNT_ID;

  return {
    async getAccount(): Promise<RawMetaAccount> {
      const url = buildGraphUrl(accountId, {
        fields: 'id,name,account_id,currency,timezone_name',
      });
      const body = await fetchJsonWithRetry(url);
      return parseDto(rawMetaAccountSchema, body, 'GET ad account');
    },

    async getCampaigns(): Promise<RawMetaCampaign[]> {
      return fetchAllPages(
        buildGraphUrl(`${accountId}/campaigns`, {
          fields: 'id,name,status,effective_status,objective,created_time',
          limit: String(META_LIST_PAGE_LIMIT),
        }),
        rawMetaCampaignSchema,
        'GET campaigns',
      );
    },

    async getAdSets(): Promise<RawMetaAdSet[]> {
      return fetchAllPages(
        buildGraphUrl(`${accountId}/adsets`, {
          fields:
            'id,name,status,effective_status,campaign_id,optimization_goal,billing_event,daily_budget,lifetime_budget,created_time',
          limit: String(META_LIST_PAGE_LIMIT),
        }),
        rawMetaAdSetSchema,
        'GET adsets',
      );
    },

    async getAds(): Promise<RawMetaAd[]> {
      return fetchAllPages(
        buildGraphUrl(`${accountId}/ads`, {
          fields: 'id,name,status,effective_status,adset_id,campaign_id,creative,created_time',
          limit: String(META_LIST_PAGE_LIMIT),
        }),
        rawMetaAdSchema,
        'GET ads',
      );
    },

    async getDailyInsights(sinceDate: string, untilDate: string): Promise<RawMetaInsightRow[]> {
      const windows = env.META_ATTRIBUTION_WINDOWS.split(',')
        .map((window) => window.trim())
        .filter((window) => window.length > 0);

      // [WHY] always pass action_attribution_windows explicitly — Meta's default
      // attribution window does not necessarily match what Ads Manager displays,
      // which is the single most common cause of numbers not reconciling with the UI.
      return fetchAllPages(
        buildGraphUrl(`${accountId}/insights`, {
          level: 'ad',
          time_increment: '1',
          time_range: JSON.stringify({ since: sinceDate, until: untilDate }),
          fields: 'ad_id,adset_id,campaign_id,date_start,impressions,clicks,spend,actions,action_values',
          action_attribution_windows: JSON.stringify(windows),
          limit: String(META_INSIGHTS_PAGE_LIMIT),
        }),
        rawMetaInsightRowSchema,
        'GET insights',
      );
    },
  };
}

/**
 * Walks Graph API `paging.next` until the list is exhausted.
 *
 * @param firstUrl - First page URL
 * @param itemSchema - Zod schema for each row
 * @param label - Error label
 * @returns All rows across pages
 */
async function fetchAllPages<T>(
  firstUrl: string,
  itemSchema: z.ZodType<T>,
  label: string,
): Promise<T[]> {
  const items: T[] = [];
  let nextUrl: string | null = firstUrl;

  while (nextUrl !== null) {
    const body = await fetchJsonWithRetry(nextUrl);
    const parsed: MetaListResponse<T> = parseDto(metaListSchema(itemSchema), body, label);
    items.push(...parsed.data);
    nextUrl = parsed.paging?.next ?? null;
  }

  return items;
}

/**
 * Builds a Graph API URL with the access token and extra query params.
 *
 * @param pathname - Path after /{version}/
 * @param params - Extra query parameters
 * @returns Absolute URL
 */
function buildGraphUrl(pathname: string, params: GraphQueryParams): string {
  const url = new URL(`https://graph.facebook.com/${env.META_API_VERSION}/${pathname}`);
  url.searchParams.set('access_token', env.META_ACCESS_TOKEN);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return url.toString();
}

/**
 * Fetches JSON and retries on HTTP 429 or Meta rate-limit error codes.
 *
 * @param url - Absolute request URL
 * @returns Parsed JSON body
 * @throws {Error} after retries are exhausted or on a non-retryable error
 */
async function fetchJsonWithRetry(url: string): Promise<unknown> {
  let attempt = 0;

  while (attempt <= META_MAX_RETRIES) {
    const result = await fetchJson(url);
    const graphError = readGraphError(result.body);

    if (!shouldRetry(result.status, graphError) || attempt === META_MAX_RETRIES) {
      if (result.status >= 400 || graphError !== null) {
        const message = graphError?.message ?? `Graph API request failed with HTTP ${result.status}`;
        throw new Error(message);
      }
      return result.body;
    }

    const delayMs = 2 ** attempt * 1000;
    logger.warn('Meta rate limit, retrying', { attempt, delayMs, status: result.status });
    await sleep(delayMs);
    attempt += 1;
  }

  throw new Error('Graph API retries exhausted');
}

/**
 * Performs a single GET and parses the body as JSON.
 *
 * @param url - Absolute request URL
 * @returns HTTP status and parsed body
 */
async function fetchJson(url: string): Promise<FetchJsonResult> {
  const response = await fetch(url);
  const text = await response.text();
  if (text.length === 0) {
    return { status: response.status, body: null };
  }

  const body: unknown = JSON.parse(text);
  return { status: response.status, body };
}

/**
 * Returns true when the Graph API asks us to back off.
 *
 * @param status - HTTP status
 * @param graphError - Parsed Graph error, if any
 * @returns Whether to retry
 */
function shouldRetry(status: number, graphError: GraphErrorBody | null): boolean {
  if (status === 429) {
    return true;
  }
  if (graphError === null) {
    return false;
  }
  return META_RATE_LIMIT_ERROR_CODES.includes(graphError.code);
}

/**
 * Reads Meta's `{ error: { message, code } }` envelope without type casts.
 *
 * @param body - Parsed JSON body
 * @returns Graph error fields, or null if the shape does not match
 */
function readGraphError(body: unknown): GraphErrorBody | null {
  if (typeof body !== 'object' || body === null) {
    return null;
  }
  if (!('error' in body)) {
    return null;
  }

  const error = body.error;
  if (typeof error !== 'object' || error === null) {
    return null;
  }
  if (!('message' in error) || !('code' in error)) {
    return null;
  }
  if (typeof error.message !== 'string' || typeof error.code !== 'number') {
    return null;
  }

  return { message: error.message, code: error.code };
}

/**
 * Waits for the given number of milliseconds.
 *
 * @param ms - Delay
 * @returns Resolves after the delay
 */
async function sleep(ms: number): Promise<void> {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}
