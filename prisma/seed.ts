import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { config as loadEnv } from 'dotenv';

// Run via tsx as a standalone script — no Next.js env loading here, so load
// .env.local ourselves before touching process.env.DATABASE_URL.
loadEnv({ path: '.env.local', quiet: true });

// Idempotent by design (specs/01-data-model-and-auth.md) — safe to re-run against an
// environment that's already been seeded; it checks for the org/admin before creating
// either.
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const ORG_NAME = 'Default Organization';
const ADMIN_EMAIL = 'admin@example.local';
// Placeholder only — this exists so the seed script has something to hash, not as a
// credential meant to survive contact with a real environment. Change it via the
// admin user management screen (specs/06-admin-dashboard.md) immediately after first
// login, and never reuse this value outside a throwaway local dev database.
const PLACEHOLDER_PASSWORD = 'ChangeMe-Clickforms-2026!';

async function main(): Promise<void> {
  const existingOrg = await prisma.organization.findFirst({
    where: { name: ORG_NAME },
  });

  const organization =
    existingOrg ?? (await prisma.organization.create({ data: { name: ORG_NAME } }));

  console.log(
    existingOrg
      ? `Organization "${organization.name}" already exists (${organization.id}) — skipping`
      : `Created organization "${organization.name}" (${organization.id})`,
  );

  const existingAdmin = await prisma.user.findFirst({
    where: { organizationId: organization.id, email: ADMIN_EMAIL },
  });

  if (existingAdmin) {
    console.log(`Admin user ${ADMIN_EMAIL} already exists (${existingAdmin.id}) — skipping`);
    return;
  }

  const passwordHash = await bcrypt.hash(PLACEHOLDER_PASSWORD, 12);
  const admin = await prisma.user.create({
    data: {
      organizationId: organization.id,
      email: ADMIN_EMAIL,
      name: 'Default Admin',
      passwordHash,
      role: 'admin',
    },
  });

  console.log(`Created admin user ${admin.email} (${admin.id})`);
  console.log('');
  console.log('================================================================');
  console.log(`  TEMP PASSWORD FOR ${admin.email}: ${PLACEHOLDER_PASSWORD}`);
  console.log('  Change this immediately after first login. Do not leave this');
  console.log('  seed script value in place in any shared or production environment.');
  console.log('================================================================');
}

main()
  .catch((error: unknown) => {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
