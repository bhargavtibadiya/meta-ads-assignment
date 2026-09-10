import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { parse } from 'csv-parse/sync';
import { db } from '../../config/prisma.js';
import { AppError } from '../../utils/helpers/app-error.js';
import { nowIso, toTimestamptzString } from '../../utils/helpers/date.js';
import { logger } from '../../utils/helpers/logger.js';
import { getFixturePath } from '../../utils/helpers/paths.js';
import type {
  CsvRow,
  ImportOrdersSummary,
  OrderListItem,
  ParsedOrderRow,
} from './types/orders.types.js';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

const ORDER_ID_COLUMNS: readonly string[] = ['order_id', 'id', 'orderId'];
const ORDERED_AT_COLUMNS: readonly string[] = ['ordered_at', 'created_at', 'order_date', 'date'];
const TOTAL_COLUMNS: readonly string[] = ['total', 'total_amount', 'amount', 'order_total'];
const CURRENCY_COLUMNS: readonly string[] = ['currency'];
const UTM_CAMPAIGN_COLUMNS: readonly string[] = ['utm_campaign', 'utmCampaign', 'campaign'];

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Imports orders.csv (or a provided path) and upserts on externalOrderId.
 *
 * @param filePath - Optional absolute or relative CSV path
 * @returns Import counts and the headers that were found
 * @throws {AppError} if the file is missing required columns
 */
export async function importOrdersFromCsv(filePath?: string): Promise<ImportOrdersSummary> {
  const resolvedPath = filePath ?? getFixturePath('orders.csv');
  const text = await readFile(resolvedPath, 'utf8');
  const records: unknown = parse(text, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true,
  });

  if (!Array.isArray(records)) {
    throw new AppError('CSV parser did not return a list of rows', 400);
  }

  const rows: CsvRow[] = [];
  for (const record of records) {
    if (!isCsvRow(record)) {
      throw new AppError('CSV parser returned a non-string row', 400);
    }
    rows.push(record);
  }

  const headers = rows.length > 0 ? Object.keys(rows[0] ?? {}) : readHeadersFromEmptyParse(text);
  logger.info('orders csv headers', { headers: headers.join(',') });

  if (rows.length > 0) {
    assertRequiredColumns(headers);
  }

  let rowsInserted = 0;
  let rowsUpdated = 0;

  for (const row of rows) {
    const parsed = parseOrderRow(row, headers);
    const wrote = await upsertOrder(parsed);
    if (wrote === 'inserted') {
      rowsInserted += 1;
    } else {
      rowsUpdated += 1;
    }
  }

  logger.info('orders import complete', {
    filePath: resolvedPath,
    rowsRead: rows.length,
    rowsInserted,
    rowsUpdated,
  });

  return {
    filePath: resolvedPath,
    headers,
    rowsRead: rows.length,
    rowsInserted,
    rowsUpdated,
  };
}

/**
 * Returns the most recently imported orders for the status page.
 *
 * @param limit - Max rows to return
 * @returns Newest-first order list
 */
export async function listRecentOrders(limit: number): Promise<OrderListItem[]> {
  const rows = await db.orm.public.Order.orderBy((order) => order.orderedAt.desc())
    .limit(limit)
    .all();

  return rows.map((row) => ({
    id: row.id,
    externalOrderId: row.externalOrderId,
    orderedAt: row.orderedAt,
    totalAmount: row.totalAmount,
    currency: row.currency,
    utmCampaign: row.utmCampaign,
  }));
}

// ============================================================================
// CSV HELPERS
// ============================================================================

/**
 * Type-guard for a CSV record of string columns.
 *
 * @param value - Unknown parser output
 * @returns Whether every value is a string
 */
function isCsvRow(value: unknown): value is CsvRow {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  for (const entry of Object.values(value)) {
    if (typeof entry !== 'string') {
      return false;
    }
  }

  return true;
}

/**
 * Throws if the CSV is missing an id, timestamp, or amount column.
 *
 * @param headers - Header names as they appeared in the file
 * @returns void
 * @throws {AppError} naming the columns that were seen
 */
function assertRequiredColumns(headers: string[]): void {
  const idColumn = findHeader(headers, ORDER_ID_COLUMNS);
  const orderedAtColumn = findHeader(headers, ORDERED_AT_COLUMNS);
  const totalColumn = findHeader(headers, TOTAL_COLUMNS);

  if (idColumn !== null && orderedAtColumn !== null && totalColumn !== null) {
    return;
  }

  throw new AppError(
    `orders.csv is missing required columns. Seen headers: ${headers.join(', ')}. Expected an id column (${ORDER_ID_COLUMNS.join('|')}), an ordered-at column (${ORDERED_AT_COLUMNS.join('|')}), and a total column (${TOTAL_COLUMNS.join('|')}).`,
    400,
  );
}

/**
 * Maps one CSV row onto the Order table fields.
 *
 * @param row - Raw CSV row
 * @param headers - Header names from the file
 * @returns Parsed order
 * @throws {AppError} if a required cell is empty or unparseable
 */
function parseOrderRow(row: CsvRow, headers: string[]): ParsedOrderRow {
  const externalOrderId = requiredCell(row, headers, ORDER_ID_COLUMNS, 'order id');
  const orderedAtRaw = requiredCell(row, headers, ORDERED_AT_COLUMNS, 'ordered at');
  const totalRaw = requiredCell(row, headers, TOTAL_COLUMNS, 'total amount');
  const totalAmount = toDecimalString(totalRaw);
  if (totalAmount === null) {
    throw new AppError(`Invalid total amount "${totalRaw}" for order ${externalOrderId}`, 400);
  }

  return {
    externalOrderId,
    orderedAt: toTimestamptzString(orderedAtRaw),
    totalAmount,
    currency: optionalCell(row, headers, CURRENCY_COLUMNS),
    utmCampaign: optionalCell(row, headers, UTM_CAMPAIGN_COLUMNS),
    rawRowJson: row,
  };
}

/**
 * Inserts or updates one order on externalOrderId.
 *
 * @param parsed - Mapped order
 * @returns Whether the row was inserted or updated
 */
async function upsertOrder(parsed: ParsedOrderRow): Promise<'inserted' | 'updated'> {
  const existing = await db.orm.public.Order.where({
    externalOrderId: parsed.externalOrderId,
  }).first();
  const importedAt = nowIso();

  if (existing === null) {
    await db.orm.public.Order.create({
      id: randomUUID(),
      externalOrderId: parsed.externalOrderId,
      orderedAt: parsed.orderedAt,
      totalAmount: parsed.totalAmount,
      currency: parsed.currency,
      utmCampaign: parsed.utmCampaign,
      rawRowJson: parsed.rawRowJson,
      importedAt,
    });
    return 'inserted';
  }

  await db.orm.public.Order.where({ id: existing.id }).update({
    orderedAt: parsed.orderedAt,
    totalAmount: parsed.totalAmount,
    currency: parsed.currency,
    utmCampaign: parsed.utmCampaign,
    rawRowJson: parsed.rawRowJson,
  });
  return 'updated';
}

/**
 * Reads a required cell by trying candidate header names case-insensitively.
 *
 * @param row - CSV row
 * @param headers - File headers
 * @param candidates - Acceptable column names
 * @param label - Field name for errors
 * @returns Cell value
 * @throws {AppError} if missing
 */
function requiredCell(
  row: CsvRow,
  headers: string[],
  candidates: readonly string[],
  label: string,
): string {
  const value = optionalCell(row, headers, candidates);
  if (value === null) {
    throw new AppError(`Missing ${label} column. Seen headers: ${headers.join(', ')}`, 400);
  }
  return value;
}

/**
 * Reads an optional cell; empty strings become null.
 *
 * @param row - CSV row
 * @param headers - File headers
 * @param candidates - Acceptable column names
 * @returns Cell value or null
 */
function optionalCell(
  row: CsvRow,
  headers: string[],
  candidates: readonly string[],
): string | null {
  const header = findHeader(headers, candidates);
  if (header === null) {
    return null;
  }
  const value = row[header];
  if (value === undefined || value.length === 0) {
    return null;
  }
  return value;
}

/**
 * Finds the first header that matches a candidate, case-insensitively.
 *
 * @param headers - File headers
 * @param candidates - Acceptable names
 * @returns Matching header, or null
 */
function findHeader(headers: string[], candidates: readonly string[]): string | null {
  for (const candidate of candidates) {
    const match = headers.find((header) => header.toLowerCase() === candidate.toLowerCase());
    if (match !== undefined) {
      return match;
    }
  }
  return null;
}

/**
 * Parses a numeric string into a Prisma Numeric decimal string.
 *
 * @param value - Raw amount
 * @returns Decimal string, or null if not numeric
 */
function toDecimalString(value: string): string | null {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return parsed.toFixed(6);
}

/**
 * Falls back to splitting the first CSV line when the file has headers but no rows.
 *
 * @param text - Full CSV text
 * @returns Header names
 */
function readHeadersFromEmptyParse(text: string): string[] {
  const firstLine = text.split(/\r?\n/)[0];
  if (firstLine === undefined || firstLine.length === 0) {
    return [];
  }
  return firstLine.split(',').map((header) => header.trim());
}
