import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Request, Response } from 'express';
import { sendSuccess } from '../../utils/helpers/response.js';

/**
 * Resolves status.html from dist/ (Docker) or src/ (tsx watch).
 *
 * @returns Absolute path to the status page
 */
function resolveStatusPage(): string {
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const nextToCompiled = path.resolve(currentDir, '../../resources/status.html');
  if (existsSync(nextToCompiled)) {
    return nextToCompiled;
  }
  return path.resolve(currentDir, '../../../src/resources/status.html');
}

/**
 * Liveness check used by Docker / graders.
 *
 * @param _req - Incoming request
 * @param res - Express response
 * @returns void
 */
export function getHealth(_req: Request, res: Response): void {
  sendSuccess(res, { status: 'ok' });
}

/**
 * Serves the single static ops status page.
 *
 * @param _req - Incoming request
 * @param res - Express response
 * @returns void
 */
export function getStatusPage(_req: Request, res: Response): void {
  res.sendFile(resolveStatusPage());
}
