export interface HierarchySyncSummary {
  readonly entityType: 'HIERARCHY';
  readonly status: 'SUCCESS' | 'FAILED';
  readonly rowsUpserted: number;
  readonly campaigns: number;
  readonly adSets: number;
  readonly ads: number;
}

export interface InsightsSyncSummary {
  readonly entityType: 'INSIGHTS';
  readonly status: 'SUCCESS' | 'FAILED';
  readonly rowsUpserted: number;
  readonly skippedMissingAds: number;
  readonly windowStart: string;
  readonly windowEnd: string;
}

export interface SyncSummary {
  readonly hierarchy: HierarchySyncSummary;
  readonly insights: InsightsSyncSummary;
}

export interface SyncRunView {
  readonly id: string;
  readonly entityType: string;
  readonly status: string;
  readonly rowsUpserted: number;
  readonly windowStart: string | null;
  readonly windowEnd: string | null;
  readonly errorMessage: string | null;
  readonly startedAt: string;
  readonly finishedAt: string | null;
}

export interface SyncStatusView {
  readonly dataSource: string;
  readonly lastSuccessfulSyncAt: string | null;
  readonly lastSyncedThroughDate: string | null;
  readonly insightRowCount: number;
  readonly lastHierarchyRun: SyncRunView | null;
  readonly lastInsightsRun: SyncRunView | null;
}
