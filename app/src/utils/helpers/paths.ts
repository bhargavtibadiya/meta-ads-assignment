import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Resolves the backend application root (`app/`), whether running from `src/` or `dist/`.
 *
 * @returns Absolute path to the app root
 */
export function getAppRoot(): string {
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(currentDir, '../../..');
}

/**
 * Resolves a path under `app/fixtures`.
 *
 * @param fileName - File name inside the fixtures directory
 * @returns Absolute fixture path
 */
export function getFixturePath(fileName: string): string {
  return path.join(getAppRoot(), 'fixtures', fileName);
}

/**
 * Resolves a path under `app/submission`.
 *
 * @param fileName - File name inside the submission directory
 * @returns Absolute submission path
 */
export function getSubmissionPath(fileName: string): string {
  return path.join(getAppRoot(), 'submission', fileName);
}
