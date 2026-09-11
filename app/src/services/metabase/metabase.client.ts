import { parseDto } from '../../utils/helpers/parse-dto.js';
import { logger } from '../../utils/helpers/logger.js';
import type {
  MetabaseCardDisplay,
  MetabaseCardRecord,
  MetabaseClient,
  MetabaseDatabaseRecord,
  MetabaseDbConfig,
  MetabaseFieldRef,
  MetabaseNativeQuestion,
  MetabaseParameterValuesSource,
  MetabaseQueryColumn,
  MetabaseSession,
  MetabaseSetupUser,
  MetabaseTemplateTag,
} from './metabase.types.js';
import {
  cardCreateResponseSchema,
  cardListSchema,
  cardQueryResponseSchema,
  databaseCreateResponseSchema,
  databaseListSchema,
  sessionPropertiesSchema,
  sessionResponseSchema,
} from './metabase.types.js';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface MetabaseClientOptions {
  readonly baseUrl: string;
}

interface JsonHeaders {
  readonly [name: string]: string;
}

interface HeaderMap {
  [name: string]: string;
}

interface NativeQueryPayload {
  readonly type: 'native';
  readonly database: number;
  readonly native: NativeQueryBody;
}

interface NativeQueryBody {
  readonly query: string;
  readonly 'template-tags': NativeTemplateTagMap;
}

interface NativeTemplateTagMap {
  readonly [name: string]: NativeTemplateTag;
}

interface NativeTemplateTag {
  readonly id: string;
  readonly name: string;
  readonly 'display-name': string;
  readonly type: 'text' | 'date';
  readonly required: boolean;
  readonly 'widget-type': string;
}

interface CardParameterValuesConfig {
  readonly card_id: number;
  readonly value_field: MetabaseFieldRef;
  readonly label_field: MetabaseFieldRef;
}

interface CardParameter {
  readonly id: string;
  readonly type: string;
  readonly name: string;
  readonly slug: string;
  readonly target: CardParameterTarget;
  readonly values_query_type?: 'list';
  readonly values_source_type?: 'card';
  readonly values_source_config?: CardParameterValuesConfig;
}

type CardParameterTarget = readonly ['variable', readonly ['template-tag', string]];

interface CardVisualizationSettings {
  readonly 'graph.dimensions'?: readonly string[];
  readonly 'graph.metrics'?: readonly string[];
  readonly 'graph.y_axis.auto_split'?: boolean;
  readonly series_settings?: SeriesSettingsMap;
}

interface SeriesSettingsMap {
  readonly [seriesName: string]: SeriesAxisSetting;
}

interface SeriesAxisSetting {
  readonly axis: 'left' | 'right';
  readonly display: 'line' | 'bar';
}

interface CardWriteBody {
  readonly name: string;
  readonly display: MetabaseCardDisplay;
  readonly dataset_query: NativeQueryPayload;
  readonly visualization_settings: CardVisualizationSettings;
  readonly parameters: readonly CardParameter[];
}

interface SetupRequest {
  readonly token: string;
  readonly user: SetupUserBody;
  readonly prefs: SetupPrefsBody;
}

interface SetupUserBody {
  readonly first_name: string;
  readonly last_name: string;
  readonly email: string;
  readonly password: string;
}

interface SetupPrefsBody {
  readonly site_name: string;
  readonly site_locale: string;
  readonly allow_tracking: boolean;
}

interface SessionLoginRequest {
  readonly username: string;
  readonly password: string;
}

interface AddDatabaseRequest {
  readonly engine: 'postgres';
  readonly name: string;
  readonly details: PostgresDetails;
  readonly is_full_sync: boolean;
  readonly is_on_demand: boolean;
}

interface PostgresDetails {
  readonly host: string;
  readonly port: number;
  readonly dbname: string;
  readonly user: string;
  readonly password: string;
  readonly ssl: boolean;
}

interface CardQueryColumnInput {
  readonly name: string;
  readonly base_type: string;
}

// ============================================================================
// PUBLIC FACTORY
// ============================================================================

/**
 * Builds a thin Metabase REST client for session login and one-time wiring.
 *
 * @param options - Base URL of the running Metabase instance
 * @returns Client used by the provision script
 */
export function createMetabaseClient(options: MetabaseClientOptions): MetabaseClient {
  const baseUrl = options.baseUrl.replace(/\/$/, '');

  return {
    async isSetupComplete(): Promise<boolean> {
      const body = await requestJson('GET', `${baseUrl}/api/session/properties`, null, {});
      const props = parseDto(sessionPropertiesSchema, body, 'Metabase session properties');
      return props['has-user-setup'] === true;
    },

    async createSetupAdmin(user: MetabaseSetupUser): Promise<MetabaseSession> {
      // [WHY] session-first API flow so docker compose up + one script wires Metabase without the UI wizard
      const propertiesBody = await requestJson('GET', `${baseUrl}/api/session/properties`, null, {});
      const properties = parseDto(
        sessionPropertiesSchema,
        propertiesBody,
        'Metabase setup properties',
      );
      const token = properties['setup-token'];
      if (token === undefined || token === null || token.length === 0) {
        throw new Error('Metabase setup token is missing; setup may already be complete');
      }

      const setupBody: SetupRequest = {
        token,
        user: {
          first_name: user.firstName,
          last_name: user.lastName,
          email: user.email,
          password: user.password,
        },
        prefs: {
          site_name: user.siteName,
          site_locale: 'en',
          allow_tracking: false,
        },
      };

      const response = await requestJson('POST', `${baseUrl}/api/setup`, JSON.stringify(setupBody), {});
      const session = parseDto(sessionResponseSchema, response, 'Metabase setup session');
      return { token: session.id };
    },

    async createSession(username: string, password: string): Promise<string> {
      const login: SessionLoginRequest = { username, password };
      const response = await requestJson(
        'POST',
        `${baseUrl}/api/session`,
        JSON.stringify(login),
        {},
      );
      const session = parseDto(sessionResponseSchema, response, 'Metabase session');
      return session.id;
    },

    async listDatabases(sessionToken: string): Promise<MetabaseDatabaseRecord[]> {
      const body = await requestJson('GET', `${baseUrl}/api/database`, null, sessionHeaders(sessionToken));
      const parsed = parseDto(databaseListSchema, body, 'Metabase database list');
      return Array.isArray(parsed) ? parsed : parsed.data;
    },

    async addPostgresDatabase(sessionToken: string, config: MetabaseDbConfig): Promise<number> {
      const existing = await this.listDatabases(sessionToken);
      const match = existing.find((database) => database.name === config.name);
      if (match !== undefined) {
        logger.info('Metabase database already registered', { name: config.name, id: match.id });
        return match.id;
      }

      const addBody: AddDatabaseRequest = {
        engine: 'postgres',
        name: config.name,
        details: {
          host: config.host,
          port: config.port,
          dbname: config.dbname,
          user: config.user,
          password: config.password,
          ssl: false,
        },
        is_full_sync: true,
        is_on_demand: false,
      };
      const response = await requestJson(
        'POST',
        `${baseUrl}/api/database`,
        JSON.stringify(addBody),
        sessionHeaders(sessionToken),
      );
      const created = parseDto(databaseCreateResponseSchema, response, 'Metabase add database');
      return created.id;
    },

    async listCards(sessionToken: string): Promise<MetabaseCardRecord[]> {
      const body = await requestJson('GET', `${baseUrl}/api/card`, null, sessionHeaders(sessionToken));
      const parsed = parseDto(cardListSchema, body, 'Metabase card list');
      return Array.isArray(parsed) ? parsed : parsed.data;
    },

    async upsertNativeQuestion(
      sessionToken: string,
      databaseId: number,
      question: MetabaseNativeQuestion,
    ): Promise<number> {
      const payload = buildCardWriteBody(databaseId, question);
      const existing = await this.listCards(sessionToken);
      const match = existing.find((card) => card.name === question.name);
      if (match !== undefined) {
        await requestJson(
          'PUT',
          `${baseUrl}/api/card/${match.id}`,
          JSON.stringify(payload),
          sessionHeaders(sessionToken),
        );
        logger.info('updated Metabase question', { name: question.name, id: match.id });
        return match.id;
      }

      const response = await requestJson(
        'POST',
        `${baseUrl}/api/card`,
        JSON.stringify(payload),
        sessionHeaders(sessionToken),
      );
      const created = parseDto(cardCreateResponseSchema, response, 'Metabase create card');
      logger.info('created Metabase question', { name: question.name, id: created.id });
      return created.id;
    },

    async queryCardColumns(sessionToken: string, cardId: number): Promise<MetabaseQueryColumn[]> {
      const body = await requestJson(
        'POST',
        `${baseUrl}/api/card/${cardId}/query`,
        JSON.stringify({ ignore_cache: true, parameters: [] }),
        sessionHeaders(sessionToken),
      );
      const parsed = parseDto(cardQueryResponseSchema, body, 'Metabase card query');
      return parsed.data.cols.map(toQueryColumn);
    },
  };
}

/**
 * Builds the native SQL card payload Metabase expects, including optional filters.
 *
 * @param databaseId - Metabase database id for Meta Ads Data
 * @param question - Name, SQL, and template tags
 * @returns Card write body
 */
function buildCardWriteBody(databaseId: number, question: MetabaseNativeQuestion): CardWriteBody {
  return {
    name: question.name,
    display: question.display,
    dataset_query: {
      type: 'native',
      database: databaseId,
      native: {
        query: question.sql,
        'template-tags': toNativeTemplateTags(question.templateTags),
      },
    },
    visualization_settings: buildVisualizationSettings(question.display),
    parameters: toCardParameters(question.templateTags),
  };
}

/**
 * Chart cards get dual-axis settings; the campaign picker is a plain table.
 *
 * @param display - Saved-question display type
 * @returns Visualization settings Metabase accepts for that display
 */
function buildVisualizationSettings(display: MetabaseCardDisplay): CardVisualizationSettings {
  if (display !== 'combo' && display !== 'line') {
    return {};
  }

  return {
    'graph.dimensions': ['date'],
    'graph.metrics': ['daily_spend', 'daily_order_count'],
    'graph.y_axis.auto_split': true,
    series_settings: {
      daily_spend: { axis: 'left', display: 'line' },
      daily_order_count: { axis: 'right', display: 'bar' },
    },
  };
}

/**
 * Converts our template-tag map into Metabase's hyphenated JSON keys.
 *
 * @param tags - Internal template tags
 * @returns Metabase native template-tags object
 */
function toNativeTemplateTags(tags: MetabaseNativeQuestion['templateTags']): NativeTemplateTagMap {
  const result: { [name: string]: NativeTemplateTag } = {};
  for (const [name, tag] of Object.entries(tags)) {
    result[name] = toNativeTemplateTag(tag);
  }
  return result;
}

/**
 * Maps one template tag into Metabase's native query shape.
 *
 * @param tag - Internal tag
 * @returns Metabase tag
 */
function toNativeTemplateTag(tag: MetabaseTemplateTag): NativeTemplateTag {
  return {
    id: tag.id,
    name: tag.name,
    'display-name': tag.displayName,
    type: tag.type,
    required: tag.required,
    'widget-type': tag.type === 'date' ? 'date/single' : 'string/=',
  };
}

/**
 * Builds Metabase card-level parameter widgets for the template tags.
 *
 * @param tags - Internal template tags
 * @returns Parameters array for the saved question
 */
function toCardParameters(tags: MetabaseNativeQuestion['templateTags']): CardParameter[] {
  const parameters: CardParameter[] = [];
  for (const tag of Object.values(tags)) {
    parameters.push(toCardParameter(tag));
  }
  return parameters;
}

/**
 * Maps one template tag onto a Metabase card parameter, including dropdown source.
 *
 * @param tag - Internal tag
 * @returns Card parameter
 */
function toCardParameter(tag: MetabaseTemplateTag): CardParameter {
  const target: CardParameterTarget = ['variable', ['template-tag', tag.name]];
  const parameter: CardParameter = {
    id: tag.id,
    type: tag.type === 'date' ? 'date/single' : 'string/=',
    name: tag.displayName,
    slug: tag.name,
    target,
  };

  if (tag.valuesSource === undefined) {
    return parameter;
  }

  return withCardValuesSource(parameter, tag.valuesSource);
}

/**
 * Attaches a saved-question dropdown (value + label columns) to a parameter.
 *
 * @param parameter - Base parameter
 * @param source - Picker card and field refs
 * @returns Parameter with values_source_* set
 */
function withCardValuesSource(
  parameter: CardParameter,
  source: MetabaseParameterValuesSource,
): CardParameter {
  return {
    ...parameter,
    values_query_type: 'list',
    values_source_type: 'card',
    values_source_config: {
      card_id: source.cardId,
      value_field: source.valueField,
      label_field: source.labelField,
    },
  };
}

/**
 * Maps a Metabase query column onto our column shape.
 *
 * @param column - Raw col from POST /api/card/:id/query
 * @returns Named field ref used by values_source_config
 */
function toQueryColumn(column: CardQueryColumnInput): MetabaseQueryColumn {
  return {
    name: column.name,
    baseType: column.base_type,
    fieldRef: ['field', column.name, { 'base-type': column.base_type }],
  };
}

/**
 * Session header map for authenticated Metabase calls.
 *
 * @param sessionToken - Value of X-Metabase-Session
 * @returns Header object
 */
function sessionHeaders(sessionToken: string): JsonHeaders {
  return { 'X-Metabase-Session': sessionToken };
}

/**
 * Performs a JSON HTTP call against Metabase and returns the parsed body.
 *
 * @param method - HTTP method
 * @param url - Absolute URL
 * @param bodyText - Serialized JSON body, or null for GET
 * @param headers - Extra headers
 * @returns Parsed JSON, or null for an empty body
 * @throws {Error} on non-2xx responses
 */
async function requestJson(
  method: string,
  url: string,
  bodyText: string | null,
  headers: JsonHeaders,
): Promise<unknown> {
  const requestHeaders: HeaderMap = {
    Accept: 'application/json',
    ...headers,
  };
  if (bodyText !== null) {
    requestHeaders['Content-Type'] = 'application/json';
  }

  const response = await fetch(url, {
    method,
    headers: requestHeaders,
    body: bodyText ?? undefined,
  });

  const text = await response.text();
  const parsed: unknown = text.length === 0 ? null : parseJsonText(text);

  if (!response.ok) {
    const detail = summarizeError(parsed, text);
    throw new Error(`Metabase ${method} ${url} failed (${response.status}): ${detail}`);
  }

  return parsed;
}

/**
 * Parses a JSON string at the HTTP boundary.
 *
 * @param text - Response text
 * @returns Parsed value
 */
function parseJsonText(text: string): unknown {
  return JSON.parse(text);
}

/**
 * Pulls a readable error message out of a Metabase error body.
 *
 * @param parsed - Parsed JSON, if any
 * @param fallback - Raw text
 * @returns Short error string
 */
function summarizeError(parsed: unknown, fallback: string): string {
  if (typeof parsed === 'object' && parsed !== null && 'message' in parsed) {
    const message = parsed.message;
    if (typeof message === 'string') {
      return message;
    }
  }
  return fallback.length > 0 ? fallback.slice(0, 400) : 'empty body';
}