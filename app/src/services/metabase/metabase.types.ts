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

export interface MetabaseNativeQuestion {
  readonly name: string;
  readonly sql: string;
  readonly display: 'combo' | 'line';
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
