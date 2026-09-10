import type { Response } from 'express';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface SuccessBody<T> {
  readonly success: true;
  readonly data: T;
}

interface ErrorBody {
  readonly success: false;
  readonly error: string;
}

/**
 * Sends a JSON success envelope.
 *
 * @param res - Express response
 * @param data - Payload to wrap
 * @param statusCode - HTTP status, defaults to 200
 * @returns void
 */
export function sendSuccess<T>(res: Response, data: T, statusCode = 200): void {
  const body: SuccessBody<T> = { success: true, data };
  res.status(statusCode).json(body);
}

/**
 * Sends a JSON error envelope.
 *
 * @param res - Express response
 * @param error - Public error message
 * @param statusCode - HTTP status, defaults to 500
 * @returns void
 */
export function sendError(res: Response, error: string, statusCode = 500): void {
  const body: ErrorBody = { success: false, error };
  res.status(statusCode).json(body);
}
