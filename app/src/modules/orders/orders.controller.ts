import type { Request, Response } from 'express';
import { parseDto } from '../../utils/helpers/parse-dto.js';
import { sendSuccess } from '../../utils/helpers/response.js';
import { importOrdersBodySchema, listOrdersQuerySchema } from './dto/orders.dto.js';
import { importOrdersFromCsv, listRecentOrders } from './orders.service.js';

/**
 * Imports orders from fixtures/orders.csv or an optional filePath body field.
 *
 * @param req - Incoming request
 * @param res - Express response
 * @returns void
 */
export async function importOrders(req: Request, res: Response): Promise<void> {
  const body = parseDto(importOrdersBodySchema, req.body ?? {}, 'import orders body');
  const summary = await importOrdersFromCsv(body.filePath);
  sendSuccess(res, summary);
}

/**
 * Lists recent imported orders for the status page.
 *
 * @param req - Incoming request
 * @param res - Express response
 * @returns void
 */
export async function listOrders(req: Request, res: Response): Promise<void> {
  const query = parseDto(listOrdersQuerySchema, req.query, 'list orders query');
  const orders = await listRecentOrders(query.limit);
  sendSuccess(res, { orders, limit: query.limit });
}
