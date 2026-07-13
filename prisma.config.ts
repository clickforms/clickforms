import { config as loadEnv } from 'dotenv';
import { defineConfig, env } from 'prisma/config';

// The Prisma CLI (generate/migrate/studio) runs as a standalone process — it
// doesn't get Next.js's automatic .env.local loading, so we load it ourselves.
// In CI/production, DATABASE_URL is already set in the real environment (from
// SSM Parameter Store via the entrypoint script — see specs/00-infrastructure.md),
// so this is a silent no-op there (dotenv just won't find a .env.local file).
loadEnv({ path: '.env.local', quiet: true });

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
