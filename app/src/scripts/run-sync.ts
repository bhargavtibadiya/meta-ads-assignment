import { db } from '../config/prisma.js';
import { runFullSync } from '../modules/meta-sync/meta-sync.service.js';
import { logger } from '../utils/helpers/logger.js';

/**
 * CLI entry point for `npm run sync:run`.
 *
 * @returns void
 */
async function main(): Promise<void> {
  try {
    const summary = await runFullSync();
    logger.info('sync:run finished', {
      hierarchyRows: summary.hierarchy.rowsUpserted,
      insightRows: summary.insights.rowsUpserted,
      windowStart: summary.insights.windowStart,
      windowEnd: summary.insights.windowEnd,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'sync:run failed';
    logger.error('sync:run failed', { message });
    process.exitCode = 1;
  } finally {
    await db.close();
  }
}

void main();
