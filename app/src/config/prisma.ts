import postgres from '@prisma/orm-postgres/runtime';
import { env } from './env.js';
import type { Contract } from '../../prisma/contract.d.ts';
import contractJson from '../../prisma/contract.json' with { type: 'json' };

// [WHY] Prisma 8 has no @prisma/client generate step. The runtime is
// postgres<Contract>({ contractJson, url }) and must be constructed once.
export const db = postgres<Contract>({
  contractJson,
  url: env.DATABASE_URL,
});

export default db;
