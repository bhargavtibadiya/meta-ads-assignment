import type { JsonValue } from '@prisma/orm-postgres/target/codec-types';
import { z } from 'zod';
import { MetaEntityStatus } from '../../utils/constants/enums.js';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface MetaAdsClient {
  getAccount(): Promise<RawMetaAccount>;
  getCampaigns(): Promise<RawMetaCampaign[]>;
  getAdSets(): Promise<RawMetaAdSet[]>;
  getAds(): Promise<RawMetaAd[]>;
  getDailyInsights(sinceDate: string, untilDate: string): Promise<RawMetaInsightRow[]>;
}

export interface MappedAccount {
  readonly metaAdAccountId: string;
  readonly name: string;
  readonly currency: string;
  readonly timezoneName: string;
}

export interface MappedCampaign {
  readonly metaCampaignId: string;
  readonly name: string;
  readonly status: MetaEntityStatus;
  readonly effectiveStatus: MetaEntityStatus;
  readonly objective: string | null;
  readonly createdTime: string | null;
}

export interface MappedAdSet {
  readonly metaAdSetId: string;
  readonly metaCampaignId: string;
  readonly name: string;
  readonly status: MetaEntityStatus;
  readonly effectiveStatus: MetaEntityStatus;
  readonly optimizationGoal: string | null;
  readonly billingEvent: string | null;
  readonly dailyBudget: string | null;
  readonly lifetimeBudget: string | null;
  readonly createdTime: string | null;
}

export interface MappedAd {
  readonly metaAdId: string;
  readonly metaAdSetId: string;
  readonly metaCampaignId: string;
  readonly name: string;
  readonly status: MetaEntityStatus;
  readonly effectiveStatus: MetaEntityStatus;
  readonly creativeMetaId: string | null;
  readonly createdTime: string | null;
}

export interface MappedInsightRow {
  readonly metaAdId: string;
  readonly metaAdSetId: string;
  readonly metaCampaignId: string;
  readonly date: string;
  readonly impressions: number;
  readonly clicks: number;
  readonly spend: string;
  readonly purchases: number;
  readonly purchaseValue: string;
  readonly rawActionsJson: JsonValue;
}

export interface RawMetaAction {
  readonly action_type: string;
  readonly value: string;
}

export interface FixtureCampaignRenamePeriod {
  readonly name: string;
  readonly status: string;
  readonly effective_status: string;
  readonly valid_from: string;
  readonly valid_to: string | null;
}

export interface FixtureCampaignRename {
  readonly meta_campaign_id: string;
  readonly names: FixtureCampaignRenamePeriod[];
}

interface MetaPaging {
  readonly next?: string;
}

export interface MetaListResponse<T> {
  readonly data: T[];
  readonly paging?: MetaPaging;
}

export type RawMetaAccount = z.infer<typeof rawMetaAccountSchema>;
export type RawMetaCampaign = z.infer<typeof rawMetaCampaignSchema>;
export type RawMetaAdSet = z.infer<typeof rawMetaAdSetSchema>;
export type RawMetaAd = z.infer<typeof rawMetaAdSchema>;
export type RawMetaInsightRow = z.infer<typeof rawMetaInsightRowSchema>;

// ============================================================================
// ZOD SCHEMAS
// ============================================================================

const numericLikeSchema = z.union([z.string(), z.number()]).transform((value) => String(value));

const rawMetaActionSchema = z.object({
  action_type: z.string(),
  value: numericLikeSchema,
});

export const rawMetaAccountSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  account_id: z.string().optional(),
  currency: z.string().min(1),
  timezone_name: z.string().min(1),
});

export const rawMetaCampaignSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  status: z.string().min(1),
  effective_status: z.string().min(1),
  objective: z.string().nullable().optional(),
  created_time: z.string().nullable().optional(),
});

export const rawMetaAdSetSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  status: z.string().min(1),
  effective_status: z.string().min(1),
  campaign_id: z.string().min(1),
  optimization_goal: z.string().nullable().optional(),
  billing_event: z.string().nullable().optional(),
  daily_budget: numericLikeSchema.nullable().optional(),
  lifetime_budget: numericLikeSchema.nullable().optional(),
  created_time: z.string().nullable().optional(),
});

export const rawMetaAdSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  status: z.string().min(1),
  effective_status: z.string().min(1),
  adset_id: z.string().min(1),
  campaign_id: z.string().min(1),
  creative: z
    .object({
      id: z.string().min(1),
    })
    .nullable()
    .optional(),
  created_time: z.string().nullable().optional(),
});

export const rawMetaInsightRowSchema = z.object({
  ad_id: z.string().min(1),
  adset_id: z.string().min(1),
  campaign_id: z.string().min(1),
  date_start: z.string().min(1),
  date_stop: z.string().optional(),
  impressions: numericLikeSchema,
  clicks: numericLikeSchema,
  spend: numericLikeSchema,
  actions: z.array(rawMetaActionSchema).optional(),
  action_values: z.array(rawMetaActionSchema).optional(),
});

export const fixtureCampaignRenameSchema = z.object({
  meta_campaign_id: z.string().min(1),
  names: z
    .array(
      z.object({
        name: z.string().min(1),
        status: z.string().min(1),
        effective_status: z.string().min(1),
        valid_from: z.string().min(1),
        valid_to: z.string().nullable(),
      }),
    )
    .min(1),
});

/**
 * Builds a Graph API list envelope schema for one item type.
 *
 * @param itemSchema - Schema for each `data` element
 * @returns Zod schema for `{ data, paging? }`
 */
export function metaListSchema<T>(itemSchema: z.ZodType<T>): z.ZodType<MetaListResponse<T>> {
  return z.object({
    data: z.array(itemSchema),
    paging: z
      .object({
        next: z.string().optional(),
      })
      .optional(),
  });
}
