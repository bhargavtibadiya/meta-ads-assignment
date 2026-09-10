const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const OFFSET_WITHOUT_COLON_PATTERN = /([+-]\d{2})(\d{2})$/;

/**
 * Formats a Date as YYYY-MM-DD in UTC.
 *
 * @param value - The date to format
 * @returns The calendar date string
 */
export function toDateString(value: Date): string {
  return value.toISOString().slice(0, 10);
}

/**
 * Returns the current instant as an ISO-8601 timestamptz string.
 *
 * @returns UTC timestamp with a Z suffix
 */
export function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Formats a Date as YYYY-MM-DD in an IANA timezone (account timezone).
 *
 * @param value - Instant to format
 * @param timeZone - IANA timezone name, e.g. Asia/Kolkata
 * @returns Calendar date in that timezone
 */
export function toZonedDateString(value: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(value);
}

/**
 * Parses a YYYY-MM-DD string as a UTC midnight Date.
 *
 * @param dateString - Calendar date
 * @returns Date at 00:00:00.000Z
 * @throws {Error} if the string is not YYYY-MM-DD
 */
export function parseDateOnlyUtc(dateString: string): Date {
  const match = DATE_ONLY_PATTERN.exec(dateString);
  if (match === null) {
    throw new Error(`Invalid date string: ${dateString}`);
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  return new Date(Date.UTC(year, month - 1, day));
}

/**
 * Adds a signed day count to a YYYY-MM-DD calendar date.
 *
 * @param dateString - Starting calendar date
 * @param days - Days to add (negative to subtract)
 * @returns Resulting calendar date
 */
export function addDaysToDateString(dateString: string, days: number): string {
  const date = parseDateOnlyUtc(dateString);
  date.setUTCDate(date.getUTCDate() + days);
  return toDateString(date);
}

/**
 * Returns the lexicographically earlier YYYY-MM-DD string.
 *
 * @param left - First date
 * @param right - Second date
 * @returns The earlier date string
 */
export function minDateString(left: string, right: string): string {
  return left < right ? left : right;
}

/**
 * Normalizes a Meta or CSV timestamp into ISO-8601 UTC.
 *
 * @param value - Timestamp that may use Meta's +0530 offset form
 * @returns ISO timestamptz string
 * @throws {Error} if the value cannot be parsed
 */
export function toTimestamptzString(value: string): string {
  const withColon = value.replace(OFFSET_WITHOUT_COLON_PATTERN, '$1:$2');
  const parsed = new Date(withColon);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid timestamp: ${value}`);
  }
  return parsed.toISOString();
}
