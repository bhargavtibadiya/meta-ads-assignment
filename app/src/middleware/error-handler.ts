import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../utils/helpers/app-error.js';
import { logger } from '../utils/helpers/logger.js';
import { sendError } from '../utils/helpers/response.js';

/**
 * Catches unhandled errors from route handlers and returns a JSON envelope.
 *
 * @param error - Thrown value from downstream middleware
 * @param _req - Incoming request (unused)
 * @param res - Express response
 * @param _next - Next function (unused; required by Express error-middleware signature)
 * @returns void
 */
export function errorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (error instanceof AppError) {
    logger.warn('handled request error', { message: error.message, statusCode: error.statusCode });
    sendError(res, error.message, error.statusCode);
    return;
  }

  const message = error instanceof Error ? error.message : 'Unexpected error';
  logger.error('unhandled request error', { message });
  sendError(res, message, 500);
}
