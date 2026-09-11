import { z } from 'zod';

export const importOrdersBodySchema = z.object({
  filePath: z.string().min(1).optional(),
});

export const listOrdersQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type ImportOrdersBody = z.infer<typeof importOrdersBodySchema>;
export type ListOrdersQuery = z.infer<typeof listOrdersQuerySchema>;
