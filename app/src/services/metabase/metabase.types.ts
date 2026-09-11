import { z } from 'zod';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface MetabaseDbConfig {
  readonly name: string;
  readonly host: string;
  readonly port: number;
  readonly dbname: string;
  readonly user: string;
  readonly password: string;
}

export interface MetabaseSetupUser {
  readonly firstName: string;
  readonly lastName: string;
  readonly email: string;
  readonly password: string;
  readonly siteName: string;
}

export type MetabaseCardDisplay = 'combo' | 'line' | 'table';

export interface MetabaseFieldRefOptions {
  readonly 'base-type': string;
}

export type MetabaseFieldRef = readonly ['field', string, MetabaseFieldRefOptions];

export interface MetabaseQueryColumn {
  readonly name: string;
  readonly baseType: string;
  readonly fieldRef: MetabaseFieldRef;
}

export interface MetabaseStaticListValue {
  readonly value: string;
  readonly label: string;
}

export interface MetabaseParameterValuesSource {
  readonly values: readonly MetabaseStaticListValue[];
}

export interface MetabaseNativeQueryResult {
  readonly columns: readonly MetabaseQueryColumn[];
  readonly rows: readonly MetabaseNativeQueryRow[];
}

export type MetabaseNativeQueryRow = readonly MetabaseNativeQueryCell[];

export type MetabaseNativeQueryCell = string | number | boolean | null;

export interface MetabaseNativeQuestion {
  readonly name: string;
  readonly sql: string;
  readonly display: MetabaseCardDisplay;
  readonly templateTags: MetabaseTemplateTagMap;
}

export interface MetabaseTemplateTagMap {
  readonly [name: string]: MetabaseTemplateTag;
}

export interface MetabaseTemplateTag {
  readonly id: string;
  readonly name: string;
  readonly displayName: string;
  readonly type: 'text' | 'date';
  readonly required: boolean;
  readonly valuesSource?: MetabaseParameterValuesSource;
}

export interface MetabaseSession {
  readonly token: string;
}

export interface MetabaseDatabaseRecord {
  readonly id: number;
  readonly name: string;
}

export interface MetabaseCardRecord {
  readonly id: number;
  readonly name: string;
}

export interface MetabaseClient {
  isSetupComplete(): Promise<boolean>;
  createSetupAdmin(user: MetabaseSetupUser): Promise<MetabaseSession>;
  createSession(username: string, password: string): Promise<string>;
  listDatabases(sessionToken: string): Promise<MetabaseDatabaseRecord[]>;
  addPostgresDatabase(sessionToken: string, config: MetabaseDbConfig): Promise<number>;
  listCards(sessionToken: string): Promise<MetabaseCardRecord[]>;
  queryNativeSql(
    sessionToken: string,
    databaseId: number,
    sql: string,
  ): Promise<MetabaseNativeQueryResult>;
  upsertNativeQuestion(
    sessionToken: string,
    databaseId: number,
    question: MetabaseNativeQuestion,
  ): Promise<number>;
}

export type SessionProperties = z.infer<typeof sessionPropertiesSchema>;

// ============================================================================
// ZOD SCHEMAS
// ============================================================================

export const sessionPropertiesSchema = z
  .object({
    'setup-token': z.string().nullable().optional(),
    'has-user-setup': z.boolean().optional(),
  })
  .passthrough();

export const sessionResponseSchema = z.object({
  id: z.string().min(1),
});

export const databaseRecordSchema = z.object({
  id: z.number(),
  name: z.string(),
});

export const databaseListSchema = z.union([
  z.array(databaseRecordSchema),
  z.object({
    data: z.array(databaseRecordSchema),
  }),
]);

export const cardRecordSchema = z.object({
  id: z.number(),
  name: z.string(),
});

export const cardListSchema = z.union([
  z.array(cardRecordSchema),
  z.object({
    data: z.array(cardRecordSchema),
  }),
]);

export const databaseCreateResponseSchema = z.object({
  id: z.number(),
});

export const cardCreateResponseSchema = z.object({
  id: z.number(),
});

export const cardQueryColumnSchema = z
  .object({
    name: z.string(),
    base_type: z.string(),
  })
  .passthrough();

export const cardQueryResponseSchema = z
  .object({
    data: z.object({
      cols: z.array(cardQueryColumnSchema),
      rows: z.array(z.array(z.union([z.string(), z.number(), z.boolean(), z.null()]))).optional(),
    }),
  })
  .passthrough();
