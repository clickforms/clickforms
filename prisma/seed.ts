import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { config as loadEnv } from 'dotenv';
import { slugify } from '../src/lib/forms/slug';
import { createIncidentReportSchema } from './seed-data/incident-report-schema';

// Run via tsx as a standalone script — no Next.js env loading here, so load
// .env.local ourselves before touching process.env.DATABASE_URL.
loadEnv({ path: '.env.local', quiet: true });

// Idempotent by design (specs/01-data-model-and-auth.md) — safe to re-run against an
// environment that's already been seeded; it checks for the org/admin before creating
// either.
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const ORG_NAME = 'Default Organization';
// Local dev only — real orgs get their subdomain auto-generated at signup (see
// src/app/api/auth/signup/verify/route.ts). This one just needs to be a valid,
// unique-in-this-database value so `subdomain` (now NOT NULL) can be satisfied.
const ORG_SUBDOMAIN = slugify(ORG_NAME);
const ADMIN_EMAIL = 'admin@example.local';
// Placeholder only — this exists so the seed script has something to hash, not as a
// credential meant to survive contact with a real environment. Change it via the
// admin user management screen (specs/06-admin-dashboard.md) immediately after first
// login, and never reuse this value outside a throwaway local dev database.
const PLACEHOLDER_PASSWORD = 'LocalChecking2026!';

async function main(): Promise<void> {
  const existingOrg = await prisma.organization.findFirst({
    where: { name: ORG_NAME },
  });

  const organization =
    existingOrg ??
    (await prisma.organization.create({ data: { name: ORG_NAME, subdomain: ORG_SUBDOMAIN } }));

  console.log(
    existingOrg
      ? `Organization "${organization.name}" already exists (${organization.id}) — skipping`
      : `Created organization "${organization.name}" (${organization.id})`,
  );

  const existingAdmin = await prisma.user.findFirst({
    where: { organizationId: organization.id, email: ADMIN_EMAIL },
  });

  const passwordHash = await bcrypt.hash(PLACEHOLDER_PASSWORD, 12);
  let seedAdminId: string;

  if (existingAdmin) {
    await prisma.user.update({
      where: { id: existingAdmin.id },
      data: { passwordHash },
    });
    seedAdminId = existingAdmin.id;
    console.log(`Admin user ${ADMIN_EMAIL} already exists (${existingAdmin.id}) — password reset`);
    console.log('');
    console.log('================================================================');
    console.log(`  TEMP PASSWORD FOR ${ADMIN_EMAIL}: ${PLACEHOLDER_PASSWORD}`);
    console.log('  Change this immediately after first login. Do not leave this');
    console.log('  seed script value in place in any shared or production environment.');
    console.log('================================================================');
  } else {
    const admin = await prisma.user.create({
      data: {
        organizationId: organization.id,
        email: ADMIN_EMAIL,
        name: 'Default Admin',
        passwordHash,
        role: 'admin',
      },
    });
    seedAdminId = admin.id;

    console.log(`Created admin user ${admin.email} (${admin.id})`);
    console.log('');
    console.log('================================================================');
    console.log(`  TEMP PASSWORD FOR ${admin.email}: ${PLACEHOLDER_PASSWORD}`);
    console.log('  Change this immediately after first login. Do not leave this');
    console.log('  seed script value in place in any shared or production environment.');
    console.log('================================================================');
  }

  await seedIncidentReportTemplate(seedAdminId);
}

/**
 * Seeds the one built-in template every install should have, published so it shows up
 * in /forms/templates immediately. Idempotent on name, matching the org/admin checks
 * above — re-running the seed script just refreshes the schema rather than duplicating
 * the row. Attributed to whichever platform admin already exists (create-platform-admin
 * -user.ts runs separately and may or may not have been run yet), falling back to the
 * default org admin created above so this never blocks on that script's ordering.
 */
async function seedIncidentReportTemplate(fallbackUserId: string): Promise<void> {
  const platformAdmin = await prisma.user.findFirst({
    where: { isPlatformAdmin: true },
    select: { id: true },
  });
  const createdBy = platformAdmin?.id ?? fallbackUserId;

  const existingTemplate = await prisma.formTemplate.findFirst({
    where: { name: 'Incident report' },
  });

  const schema = createIncidentReportSchema();

  if (existingTemplate) {
    await prisma.formTemplate.update({
      where: { id: existingTemplate.id },
      data: { schema },
    });
    console.log(
      `Template "Incident report" already exists (${existingTemplate.id}) — schema refreshed`,
    );
    return;
  }

  const template = await prisma.formTemplate.create({
    data: {
      name: 'Incident report',
      description:
        'NDIS incident report with participant details, incident types, reviewer section, and stakeholder notifications.',
      category: 'Incident & safety',
      status: 'published',
      schema,
      createdBy,
    },
  });
  console.log(`Created template "${template.name}" (${template.id})`);
}

main()
  .catch((error: unknown) => {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
