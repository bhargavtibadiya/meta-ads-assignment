#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/6accbfe60fe3672058e9a77ac0b86348fd8b9b69d29fb1b74b771a84299f040c/contract';
import endContract from '../../snapshots/6accbfe60fe3672058e9a77ac0b86348fd8b9b69d29fb1b74b771a84299f040c/contract.json' with { type: 'json' };
import {
  Migration,
  MigrationCLI,
  checkExpression,
  col,
  fn,
  lit,
  primaryKey,
} from '@prisma/orm-postgres/migration';

export default class M extends Migration<never, End> {
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createSchema({ schema: 'public' }),
      this.createTable({
        schema: 'public',
        table: 'ad_accounts',
        columns: [
          col('created_at', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('currency', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('meta_ad_account_id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('timezone_name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updated_at', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'ad_insight_daily',
        columns: [
          col('ad_id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('ad_set_id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('attribution_windows', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('campaign_id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('clicks', 'int4', {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('created_at', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('date', 'date', { notNull: true, codecRef: { codecId: 'pg/date-string@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('impressions', 'int4', {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('purchase_value', 'numeric', {
            notNull: true,
            default: lit('0'),
            codecRef: { codecId: 'pg/numeric@1' },
          }),
          col('purchases', 'int4', {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('raw_actions_json', 'jsonb', { codecRef: { codecId: 'pg/jsonb@1' } }),
          col('spend', 'numeric', {
            notNull: true,
            default: lit('0'),
            codecRef: { codecId: 'pg/numeric@1' },
          }),
          col('synced_at', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('updated_at', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'ad_set_versions',
        columns: [
          col('ad_set_id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('effective_status', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('status', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('valid_from', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('valid_to', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'ad_set_versions_effective_status_check_4695fc4a',
            "\"effective_status\" IN ('ACTIVE', 'PAUSED', 'DELETED', 'ARCHIVED', 'IN_PROCESS', 'WITH_ISSUES', 'CAMPAIGN_PAUSED', 'ADSET_PAUSED', 'UNKNOWN')",
          ),
          checkExpression(
            'ad_set_versions_status_check_8334ea1b',
            "\"status\" IN ('ACTIVE', 'PAUSED', 'DELETED', 'ARCHIVED', 'IN_PROCESS', 'WITH_ISSUES', 'CAMPAIGN_PAUSED', 'ADSET_PAUSED', 'UNKNOWN')",
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'ad_sets',
        columns: [
          col('billing_event', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('campaign_id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('created_at', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('current_name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('current_status', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('daily_budget', 'numeric', { codecRef: { codecId: 'pg/numeric@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('lifetime_budget', 'numeric', { codecRef: { codecId: 'pg/numeric@1' } }),
          col('meta_ad_set_id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('meta_created_time', 'timestamptz', {
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('optimization_goal', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('updated_at', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'ad_sets_current_status_check_b05be3ef',
            "\"current_status\" IN ('ACTIVE', 'PAUSED', 'DELETED', 'ARCHIVED', 'IN_PROCESS', 'WITH_ISSUES', 'CAMPAIGN_PAUSED', 'ADSET_PAUSED', 'UNKNOWN')",
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'ad_versions',
        columns: [
          col('ad_id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('effective_status', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('status', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('valid_from', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('valid_to', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'ad_versions_effective_status_check_4695fc4a',
            "\"effective_status\" IN ('ACTIVE', 'PAUSED', 'DELETED', 'ARCHIVED', 'IN_PROCESS', 'WITH_ISSUES', 'CAMPAIGN_PAUSED', 'ADSET_PAUSED', 'UNKNOWN')",
          ),
          checkExpression(
            'ad_versions_status_check_8334ea1b',
            "\"status\" IN ('ACTIVE', 'PAUSED', 'DELETED', 'ARCHIVED', 'IN_PROCESS', 'WITH_ISSUES', 'CAMPAIGN_PAUSED', 'ADSET_PAUSED', 'UNKNOWN')",
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'ads',
        columns: [
          col('ad_set_id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('campaign_id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('created_at', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('creative_meta_id', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('current_name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('current_status', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('meta_ad_id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('meta_created_time', 'timestamptz', {
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('updated_at', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'ads_current_status_check_b05be3ef',
            "\"current_status\" IN ('ACTIVE', 'PAUSED', 'DELETED', 'ARCHIVED', 'IN_PROCESS', 'WITH_ISSUES', 'CAMPAIGN_PAUSED', 'ADSET_PAUSED', 'UNKNOWN')",
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'campaign_versions',
        columns: [
          col('campaign_id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('effective_status', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('status', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('valid_from', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('valid_to', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'campaign_versions_effective_status_check_4695fc4a',
            "\"effective_status\" IN ('ACTIVE', 'PAUSED', 'DELETED', 'ARCHIVED', 'IN_PROCESS', 'WITH_ISSUES', 'CAMPAIGN_PAUSED', 'ADSET_PAUSED', 'UNKNOWN')",
          ),
          checkExpression(
            'campaign_versions_status_check_8334ea1b',
            "\"status\" IN ('ACTIVE', 'PAUSED', 'DELETED', 'ARCHIVED', 'IN_PROCESS', 'WITH_ISSUES', 'CAMPAIGN_PAUSED', 'ADSET_PAUSED', 'UNKNOWN')",
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'campaigns',
        columns: [
          col('ad_account_id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('created_at', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('current_name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('current_status', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('meta_campaign_id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('meta_created_time', 'timestamptz', {
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('objective', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('updated_at', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'campaigns_current_status_check_b05be3ef',
            "\"current_status\" IN ('ACTIVE', 'PAUSED', 'DELETED', 'ARCHIVED', 'IN_PROCESS', 'WITH_ISSUES', 'CAMPAIGN_PAUSED', 'ADSET_PAUSED', 'UNKNOWN')",
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'orders',
        columns: [
          col('currency', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('external_order_id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('imported_at', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('ordered_at', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('raw_row_json', 'jsonb', { notNull: true, codecRef: { codecId: 'pg/jsonb@1' } }),
          col('total_amount', 'numeric', { notNull: true, codecRef: { codecId: 'pg/numeric@1' } }),
          col('utm_campaign', 'text', { codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'sync_cursors',
        columns: [
          col('ad_account_id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('last_successful_sync_at', 'timestamptz', {
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('last_synced_through_date', 'date', {
            notNull: true,
            codecRef: { codecId: 'pg/date-string@1' },
          }),
          col('updated_at', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'sync_runs',
        columns: [
          col('entity_type', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('error_message', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('finished_at', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('rows_upserted', 'int4', {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('started_at', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('status', 'text', {
            notNull: true,
            default: lit('RUNNING'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('window_end', 'date', { codecRef: { codecId: 'pg/date-string@1' } }),
          col('window_start', 'date', { codecRef: { codecId: 'pg/date-string@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'sync_runs_entity_type_check_20a29848',
            "\"entity_type\" IN ('HIERARCHY', 'INSIGHTS')",
          ),
          checkExpression(
            'sync_runs_status_check_5c3c95c5',
            "\"status\" IN ('RUNNING', 'SUCCESS', 'FAILED')",
          ),
        ],
      }),
      this.addUnique({
        schema: 'public',
        table: 'ad_accounts',
        constraint: 'ad_accounts_meta_ad_account_id_key',
        columns: ['meta_ad_account_id'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'ad_insight_daily',
        constraint: 'ad_insight_daily_ad_id_date_key',
        columns: ['ad_id', 'date'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'ad_sets',
        constraint: 'ad_sets_meta_ad_set_id_key',
        columns: ['meta_ad_set_id'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'ads',
        constraint: 'ads_meta_ad_id_key',
        columns: ['meta_ad_id'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'campaigns',
        constraint: 'campaigns_meta_campaign_id_key',
        columns: ['meta_campaign_id'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'orders',
        constraint: 'orders_external_order_id_key',
        columns: ['external_order_id'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'sync_cursors',
        constraint: 'sync_cursors_ad_account_id_key',
        columns: ['ad_account_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'ad_insight_daily',
        index: 'ad_insight_daily_ad_id_idx_4da8850a',
        columns: ['ad_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'ad_insight_daily',
        index: 'ad_insight_daily_ad_set_id_idx_6bb39420',
        columns: ['ad_set_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'ad_insight_daily',
        index: 'ad_insight_daily_campaign_id_date_idx_7dc28033',
        columns: ['campaign_id', 'date'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'ad_insight_daily',
        index: 'ad_insight_daily_campaign_id_idx_77cd6c37',
        columns: ['campaign_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'ad_insight_daily',
        index: 'ad_insight_daily_date_idx_b4ca319c',
        columns: ['date'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'ad_set_versions',
        index: 'ad_set_versions_ad_set_id_idx_6bb39420',
        columns: ['ad_set_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'ad_set_versions',
        index: 'ad_set_versions_ad_set_id_valid_from_idx_7ff2465f',
        columns: ['ad_set_id', 'valid_from'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'ad_sets',
        index: 'ad_sets_campaign_id_idx_77cd6c37',
        columns: ['campaign_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'ad_versions',
        index: 'ad_versions_ad_id_idx_4da8850a',
        columns: ['ad_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'ad_versions',
        index: 'ad_versions_ad_id_valid_from_idx_899ce29b',
        columns: ['ad_id', 'valid_from'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'ads',
        index: 'ads_ad_set_id_idx_6bb39420',
        columns: ['ad_set_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'ads',
        index: 'ads_campaign_id_idx_77cd6c37',
        columns: ['campaign_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'campaign_versions',
        index: 'campaign_versions_campaign_id_idx_77cd6c37',
        columns: ['campaign_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'campaign_versions',
        index: 'campaign_versions_campaign_id_valid_from_idx_67bd1ca8',
        columns: ['campaign_id', 'valid_from'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'campaigns',
        index: 'campaigns_ad_account_id_idx_a9d3bff4',
        columns: ['ad_account_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'orders',
        index: 'orders_ordered_at_idx_ab3f861d',
        columns: ['ordered_at'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'sync_runs',
        index: 'sync_runs_entity_type_started_at_idx_f5f7693b',
        columns: ['entity_type', 'started_at'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'ad_insight_daily',
        foreignKey: {
          name: 'ad_insight_daily_ad_id_fkey',
          columns: ['ad_id'],
          references: { schema: 'public', table: 'ads', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'ad_insight_daily',
        foreignKey: {
          name: 'ad_insight_daily_campaign_id_fkey',
          columns: ['campaign_id'],
          references: { schema: 'public', table: 'campaigns', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'ad_insight_daily',
        foreignKey: {
          name: 'ad_insight_daily_ad_set_id_fkey',
          columns: ['ad_set_id'],
          references: { schema: 'public', table: 'ad_sets', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'ad_set_versions',
        foreignKey: {
          name: 'ad_set_versions_ad_set_id_fkey',
          columns: ['ad_set_id'],
          references: { schema: 'public', table: 'ad_sets', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'ad_sets',
        foreignKey: {
          name: 'ad_sets_campaign_id_fkey',
          columns: ['campaign_id'],
          references: { schema: 'public', table: 'campaigns', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'ad_versions',
        foreignKey: {
          name: 'ad_versions_ad_id_fkey',
          columns: ['ad_id'],
          references: { schema: 'public', table: 'ads', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'ads',
        foreignKey: {
          name: 'ads_ad_set_id_fkey',
          columns: ['ad_set_id'],
          references: { schema: 'public', table: 'ad_sets', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'ads',
        foreignKey: {
          name: 'ads_campaign_id_fkey',
          columns: ['campaign_id'],
          references: { schema: 'public', table: 'campaigns', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'campaign_versions',
        foreignKey: {
          name: 'campaign_versions_campaign_id_fkey',
          columns: ['campaign_id'],
          references: { schema: 'public', table: 'campaigns', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'campaigns',
        foreignKey: {
          name: 'campaigns_ad_account_id_fkey',
          columns: ['ad_account_id'],
          references: { schema: 'public', table: 'ad_accounts', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'sync_cursors',
        foreignKey: {
          name: 'sync_cursors_ad_account_id_fkey',
          columns: ['ad_account_id'],
          references: { schema: 'public', table: 'ad_accounts', columns: ['id'] },
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
