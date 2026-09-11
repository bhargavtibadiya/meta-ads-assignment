import { z } from 'zod';
import { AppError } from './app-error.js';

/**
 * Parses an unknown payload with a Zod schema and throws a 400 on failure.
 *
 * @param schema - Zod schema to apply
 * @param value - Untrusted input
 * @param label - Prefix for the public error message
 * @returns The parsed value
 * @throws {AppError} if validation fails
 */
export function parseDto<T>(schema: z.ZodType<T>, value: unknown, label: string): T {
  const parsed = schema.safeParse(value);
  if (parsed.success) {
    return parsed.data;
  }

  const details = parsed.error.issues
    .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
    .join('; ');
  throw new AppError(`${label}: ${details}`, 400);
}
