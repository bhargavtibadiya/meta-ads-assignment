export enum MetaEntityStatus {
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  DELETED = 'DELETED',
  ARCHIVED = 'ARCHIVED',
  IN_PROCESS = 'IN_PROCESS',
  WITH_ISSUES = 'WITH_ISSUES',
  CAMPAIGN_PAUSED = 'CAMPAIGN_PAUSED',
  ADSET_PAUSED = 'ADSET_PAUSED',
  UNKNOWN = 'UNKNOWN',
}

export enum SyncRunStatus {
  RUNNING = 'RUNNING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
}

export enum SyncEntityType {
  HIERARCHY = 'HIERARCHY',
  INSIGHTS = 'INSIGHTS',
}

export const META_ENTITY_STATUS_VALUES: readonly MetaEntityStatus[] = [
  MetaEntityStatus.ACTIVE,
  MetaEntityStatus.PAUSED,
  MetaEntityStatus.DELETED,
  MetaEntityStatus.ARCHIVED,
  MetaEntityStatus.IN_PROCESS,
  MetaEntityStatus.WITH_ISSUES,
  MetaEntityStatus.CAMPAIGN_PAUSED,
  MetaEntityStatus.ADSET_PAUSED,
  MetaEntityStatus.UNKNOWN,
];
