import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';

loadDotenv();

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

type MetaDataSource = 'fixtures' | 'live';
type NodeEnv = 'development' | 'production' | 'test';
type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface AppEnv {
  readonly DATABASE_URL: string;
  readonly META_DATA_SOURCE: MetaDataSource;
  readonly META_ACCESS_TOKEN: string;
  readonly META_AD_ACCOUNT_ID: string;
  readonly META_API_VERSION: string;
  readonly META_ATTRIBUTION_WINDOWS: string;
  readonly META_INSIGHTS_LOOKBACK_DAYS: number;
  readonly PORT: number;
  readonly NODE_ENV: NodeEnv;
  readonly LOG_LEVEL: LogLevel;
}

interface LiveMetaFields {
  readonly META_DATA_SOURCE: 'live';
  readonly META_ACCESS_TOKEN: string;
  readonly META_AD_ACCOUNT_ID: string;
}

// ============================================================================
// SCHEMA
// ============================================================================

const envSchema = z
  .object({
    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
    META_DATA_SOURCE: z.enum(['fixtures', 'live']),
    META_ACCESS_TOKEN: z.string(),
    META_AD_ACCOUNT_ID: z.string(),
    META_API_VERSION: z.string().min(1),
    META_ATTRIBUTION_WINDOWS: z.string().min(1),
    META_INSIGHTS_LOOKBACK_DAYS: z.coerce.number().int().positive(),
    PORT: z.coerce.number().int().positive(),
    NODE_ENV: z.enum(['development', 'production', 'test']),
    LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']),
  })
  .superRefine((value, ctx) => {
    if (value.META_DATA_SOURCE !== 'live') {
      return;
    }

    const liveFields: LiveMetaFields = {
      META_DATA_SOURCE: 'live',
      META_ACCESS_TOKEN: value.META_ACCESS_TOKEN,
      META_AD_ACCOUNT_ID: value.META_AD_ACCOUNT_ID,
    };

    if (liveFields.META_ACCESS_TOKEN.length === 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['META_ACCESS_TOKEN'],
        message: 'META_ACCESS_TOKEN is required when META_DATA_SOURCE=live',
      });
    }

    if (liveFields.META_AD_ACCOUNT_ID.length === 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['META_AD_ACCOUNT_ID'],
        message: 'META_AD_ACCOUNT_ID is required when META_DATA_SOURCE=live',
      });
    }
  });

/**
 * Parses and validates process.env once at startup.
 *
 * @returns The typed application environment
 * @throws {Error} if any required variable is missing or invalid
 */
function parseEnv(): AppEnv {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid environment configuration: ${details}`);
  }

  return parsed.data;
}

export const env: AppEnv = parseEnv();
