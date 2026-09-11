import { db } from '../config/prisma.js';
import { importOrdersFromCsv } from '../modules/orders/orders.service.js';
import { logger } from '../utils/helpers/logger.js';

/**
 * CLI entry point for `npm run import:orders`. Optional argv path overrides the fixture CSV.
 *
 * @returns void
 */
async function main(): Promise<void> {
  const filePath = process.argv[2];
  try {
    const summary = await importOrdersFromCsv(filePath);
    logger.info('import:orders finished', {
      filePath: summary.filePath,
      rowsRead: summary.rowsRead,
      rowsInserted: summary.rowsInserted,
      rowsUpdated: summary.rowsUpdated,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'import:orders failed';
    logger.error('import:orders failed', { message });
    process.exitCode = 1;
  } finally {
    await db.close();
  }
}

void main();
