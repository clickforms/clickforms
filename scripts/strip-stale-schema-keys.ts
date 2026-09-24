import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { config as loadEnv } from 'dotenv';

// One-off data repair, run via tsx (`npx tsx scripts/strip-stale-schema-keys.ts`) — same
// reasoning as scripts/create-platform-admin-user.ts: no Next.js env loading here, so load
// .env.local ourselves.
//
// Why this exists: an earlier local session had a `branding.layoutStyle` field
// (table-theme import support) that got implemented, saved into some forms'/templates'
// stored schema JSON, and then reverted via `git reset --hard` before it was ever pushed —
// the code is gone, but rows already written while it existed still carry the now-unknown
// `layoutStyle` key. formSchemaSchema's strict Zod validation rejects any unrecognized key,
// so every affected Form/FormTemplate now fails to load with "Unrecognized key: layoutStyle"
// wherever its schema gets read. This strips that one stale key from `branding` on every
// affected row it finds — nothing else in the schema is touched, and rows without the
// stale key are left completely alone (the `?` jsonb operator below only matches rows that
// actually have it).
loadEnv({ path: '.env.local', quiet: true });

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const STALE_KEY = 'layoutStyle';

async function main(): Promise<void> {
  const formVersionsFixed = await prisma.$executeRawUnsafe(
    `UPDATE form_versions
     SET schema = jsonb_set(schema, '{branding}', (schema->'branding') - $1)
     WHERE schema->'branding' ? $1`,
    STALE_KEY,
  );
  console.log(`form_versions: cleared "${STALE_KEY}" from branding on ${formVersionsFixed} row(s)`);

  const templatesFixed = await prisma.$executeRawUnsafe(
    `UPDATE form_templates
     SET schema = jsonb_set(schema, '{branding}', (schema->'branding') - $1)
     WHERE schema->'branding' ? $1`,
    STALE_KEY,
  );
  console.log(`form_templates: cleared "${STALE_KEY}" from branding on ${templatesFixed} row(s)`);
}

main()
  .catch((error: unknown) => {
    console.error('Failed to strip stale schema keys:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
