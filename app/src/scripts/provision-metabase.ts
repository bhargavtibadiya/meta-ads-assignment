import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { z } from 'zod';
import { logger } from '../utils/helpers/logger.js';
import { parseDto } from '../utils/helpers/parse-dto.js';
import { getSubmissionPath } from '../utils/helpers/paths.js';
import { createMetabaseClient } from '../services/metabase/index.js';
import type {
  MetabaseClient,
  MetabaseNativeQuestion,
  MetabaseNativeQueryCell,
  MetabaseNativeQueryResult,
  MetabaseParameterValuesSource,
  MetabaseStaticListValue,
  MetabaseTemplateTagMap,
} from '../services/metabase/metabase.types.js';

// ============================================================================
// SCHEMA
// ============================================================================

const provisionEnvSchema = z.object({
  METABASE_URL: z.string().min(1).default('http://localhost:3000'),
  METABASE_ADMIN_EMAIL: z.string().email().default('admin@example.com'),
  METABASE_ADMIN_PASSWORD: z.string().min(8).default('MetaAdsAdmin1'),
  METABASE_ADMIN_FIRST_NAME: z.string().min(1).default('Meta'),
  METABASE_ADMIN_LAST_NAME: z.string().min(1).default('Admin'),
  METABASE_SITE_NAME: z.string().min(1).default('Meta Ads'),
  METABASE_DB_HOST: z.string().min(1).default('postgres'),
  METABASE_DB_PORT: z.coerce.number().int().positive().default(5432),
  METABASE_DB_NAME: z.string().min(1).default('meta_ads'),
  METABASE_DB_USER: z.string().min(1).default('postgres'),
  METABASE_DB_PASSWORD: z.string().min(1).default('postgres'),
});

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

type ProvisionEnv = z.infer<typeof provisionEnvSchema>;

const QUESTION_NAME = 'Orders vs Spend';

// [WHY] Metabase dropdowns have one label, so we concatenate current name + id
const CAMPAIGN_OPTIONS_SQL = `SELECT
  id AS campaign_id,
  current_name || ' (' || id || ')' AS campaign_label
FROM campaigns
ORDER BY current_name`;

// ============================================================================
// ENTRY
// ============================================================================

/**
 * Waits for Metabase, creates the admin if needed, registers Postgres, and saves the chart question.
 *
 * @returns void
 */
async function main(): Promise<void> {
  const env = parseDto(provisionEnvSchema, process.env, 'Metabase provision env');
  const client = createMetabaseClient({ baseUrl: env.METABASE_URL });

  await waitForMetabase(env.METABASE_URL);
  const sessionToken = await ensureSession(client, env);
  const databaseId = await client.addPostgresDatabase(sessionToken, {
    name: 'Meta Ads Data',
    host: env.METABASE_DB_HOST,
    port: env.METABASE_DB_PORT,
    dbname: env.METABASE_DB_NAME,
    user: env.METABASE_DB_USER,
    password: env.METABASE_DB_PASSWORD,
  });

  const optionsResult = await client.queryNativeSql(sessionToken, databaseId, CAMPAIGN_OPTIONS_SQL);
  const campaignOptions = toCampaignOptions(optionsResult);
  if (campaignOptions.length === 0) {
    logger.warn('no campaigns found; run sync before provision so the Campaign dropdown has rows');
  }

  const valuesSource: MetabaseParameterValuesSource = { values: campaignOptions };
  const sql = await readFile(getSubmissionPath('orders-vs-spend-question.sql'), 'utf8');
  const question: MetabaseNativeQuestion = {
    name: QUESTION_NAME,
    sql,
    display: 'combo',
    templateTags: buildTemplateTags(valuesSource),
  };
  const cardId = await client.upsertNativeQuestion(sessionToken, databaseId, question);

  logger.info('Metabase provision complete', {
    url: env.METABASE_URL,
    databaseId,
    cardId,
    campaignOptions: campaignOptions.length,
    question: QUESTION_NAME,
  });
}

/**
 * Polls Metabase /api/health until it reports a 200.
 *
 * @param baseUrl - Metabase origin
 * @returns void
 * @throws {Error} if Metabase does not become ready
 */
async function waitForMetabase(baseUrl: string): Promise<void> {
  const healthUrl = `${baseUrl.replace(/\/$/, '')}/api/health`;
  for (let attempt = 1; attempt <= 60; attempt += 1) {
    try {
      const response = await fetch(healthUrl);
      if (response.ok) {
        logger.info('Metabase is reachable', { attempt });
        return;
      }
    } catch {
      // [NOTE] Metabase takes a minute on first boot while it migrates its own schema
    }
    logger.info('waiting for Metabase', { attempt });
    await sleep(2000);
  }
  throw new Error(`Metabase did not become ready at ${healthUrl}`);
}

/**
 * Creates the first admin via /api/setup, or logs in if setup is already done.
 *
 * @param client - Metabase client
 * @param env - Provision env
 * @returns Session token
 */
async function ensureSession(client: MetabaseClient, env: ProvisionEnv): Promise<string> {
  const setupComplete = await client.isSetupComplete();
  if (!setupComplete) {
    const session = await client.createSetupAdmin({
      firstName: env.METABASE_ADMIN_FIRST_NAME,
      lastName: env.METABASE_ADMIN_LAST_NAME,
      email: env.METABASE_ADMIN_EMAIL,
      password: env.METABASE_ADMIN_PASSWORD,
      siteName: env.METABASE_SITE_NAME,
    });
    return session.token;
  }
  return client.createSession(env.METABASE_ADMIN_EMAIL, env.METABASE_ADMIN_PASSWORD);
}

/**
 * Reads campaign id + label rows from the dataset result.
 *
 * @param result - Native SQL result
 * @returns Dropdown options
 */
function toCampaignOptions(result: MetabaseNativeQueryResult): MetabaseStaticListValue[] {
  const options: MetabaseStaticListValue[] = [];
  for (const row of result.rows) {
    const value = cellToString(row[0]);
    const label = cellToString(row[1]);
    if (value === null || label === null) {
      continue;
    }
    options.push({ value, label });
  }
  return options;
}

/**
 * Coerces a dataset cell to a non-empty string.
 *
 * @param cell - Dataset cell
 * @returns String value, or null if empty
 */
function cellToString(cell: MetabaseNativeQueryCell | undefined): string | null {
  if (cell === undefined || cell === null) {
    return null;
  }
  if (typeof cell === 'string') {
    return cell.length > 0 ? cell : null;
  }
  if (typeof cell === 'number' || typeof cell === 'boolean') {
    return String(cell);
  }
  return null;
}

/**
 * Builds optional campaign and date template tags for the saved question.
 *
 * @param valuesSource - Campaign dropdown source (name + id labels, id values)
 * @returns Template tag map
 */
function buildTemplateTags(valuesSource: MetabaseParameterValuesSource): MetabaseTemplateTagMap {
  return {
    campaign: {
      id: randomUUID(),
      name: 'campaign',
      displayName: 'Campaign',
      type: 'text',
      required: false,
      valuesSource,
    },
    start_date: {
      id: randomUUID(),
      name: 'start_date',
      displayName: 'Start date',
      type: 'date',
      required: false,
    },
    end_date: {
      id: randomUUID(),
      name: 'end_date',
      displayName: 'End date',
      type: 'date',
      required: false,
    },
  };
}

/**
 * Waits for the given number of milliseconds.
 *
 * @param ms - Delay
 * @returns Resolves after the delay
 */
function sleep(ms: number): Promise<void> {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'provision-metabase failed';
  logger.error('provision-metabase failed', { message });
  process.exitCode = 1;
});
