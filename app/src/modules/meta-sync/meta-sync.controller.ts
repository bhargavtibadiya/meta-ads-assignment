import type { Request, Response } from 'express';
import { sendSuccess } from '../../utils/helpers/response.js';
import { getSyncStatus, runFullSync } from './meta-sync.service.js';

/**
 * Triggers a full hierarchy + insights sync.
 *
 * @param _req - Incoming request (no body)
 * @param res - Express response
 * @returns void
 */
export async function runSync(_req: Request, res: Response): Promise<void> {
  const summary = await runFullSync();
  sendSuccess(res, summary);
}

/**
 * Returns the latest sync cursor and run history.
 *
 * @param _req - Incoming request
 * @param res - Express response
 * @returns void
 */
export async function getStatus(_req: Request, res: Response): Promise<void> {
  const status = await getSyncStatus();
  sendSuccess(res, status);
}
