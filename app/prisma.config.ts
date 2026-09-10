import 'dotenv/config';
import { definePrismaConfig } from '@prisma/cli-engine';
import { defineConfig as ormConfig } from '@prisma/orm-postgres/config';

const databaseUrl = process.env['DATABASE_URL'];

if (databaseUrl === undefined || databaseUrl.length === 0) {
  throw new Error('DATABASE_URL is required to load prisma.config.ts');
}

export default definePrismaConfig({
  orm: ormConfig({
    contract: './prisma/schema.prisma',
    output: './prisma',
    migrations: {
      dir: './prisma/migrations',
    },
    db: {
      connection: databaseUrl,
    },
  }),
});
