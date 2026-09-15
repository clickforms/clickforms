import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { config as loadEnv } from 'dotenv';

// Run via tsx as a standalone script (`npx tsx scripts/create-platform-admin-user.ts`) —
// same reasoning as prisma/seed.ts: no Next.js env loading here, so load .env.local
// ourselves. Kept separate from seed.ts (which is meant for the default org/admin dev
// fixture) since this creates a *platform*-admin — Clickforms staff who manage every
// organisation via /admin and are not a member of any customer organisation. Idempotent.
loadEnv({ path: '.env.local', quiet: true });

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const ADMIN_EMAIL = 'admin@clickforms.com.au';
const ADMIN_NAME = 'Clickforms Admin';
// Local dev/testing only — never reuse outside a throwaway local dev database.
const ADMIN_PASSWORD = 'LocalChecking2026!';

async function main(): Promise<void> {
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);
  const existingAdmin = await prisma.user.findFirst({
    where: { email: ADMIN_EMAIL },
  });

  if (existingAdmin) {
    await prisma.user.update({
      where: { id: existingAdmin.id },
      data: {
        passwordHash,
        isPlatformAdmin: true,
        role: 'admin',
        name: ADMIN_NAME,
        organizationId: null,
      },
    });
    console.log(
      `Platform admin ${ADMIN_EMAIL} already existed (${existingAdmin.id}) — detached from any organisation`,
    );
  } else {
    const admin = await prisma.user.create({
      data: {
        organizationId: null,
        email: ADMIN_EMAIL,
        name: ADMIN_NAME,
        passwordHash,
        role: 'admin',
        isPlatformAdmin: true,
      },
    });
    console.log(`Created platform admin ${admin.email} (${admin.id})`);
  }

  console.log('');
  console.log('================================================================');
  console.log(`  PLATFORM ADMIN LOGIN: ${ADMIN_EMAIL}`);
  console.log(`  PASSWORD:             ${ADMIN_PASSWORD}`);
  console.log('  This account is not a member of any organisation.');
  console.log('  Sign in, then visit /admin.');
  console.log('================================================================');
}

main()
  .catch((error: unknown) => {
    console.error('Failed to create platform admin:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
