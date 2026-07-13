import 'server-only';

import { PrismaPg } from '@prisma/adapter-pg';
import { Prisma, PrismaClient } from '@prisma/client';

// Next.js dev-mode hot-reloading re-evaluates this module on every edit, which would
// otherwise create a fresh PrismaClient (and a fresh connection pool) on every save.
// Stashing the instance on `globalThis` survives the module reload; production never
// hits this path since the module is only evaluated once per process.
const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  prismaSchemaFingerprint?: string;
};

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });

function createPrismaClient(): PrismaClient {
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });
}

/** Fingerprint of the currently-generated Prisma schema — changes after `prisma generate`. */
function getPrismaSchemaFingerprint(): string {
  return Prisma.dmmf.datamodel.models
    .flatMap((model) => [model.name, ...model.fields.map((field) => field.name)])
    .join('\0');
}

// Hot reload keeps a stale PrismaClient on `globalThis` after `prisma generate` adds
// models or fields — the cached instance validates against an old schema until replaced.
function getPrismaClient(): PrismaClient {
  const fingerprint = getPrismaSchemaFingerprint();
  const cached = globalForPrisma.prisma;
  if (cached && globalForPrisma.prismaSchemaFingerprint === fingerprint) {
    return cached;
  }

  const client = createPrismaClient();
  if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = client;
    globalForPrisma.prismaSchemaFingerprint = fingerprint;
  }
  return client;
}

export const prisma = getPrismaClient();

/**
 * Runs `fn` inside a transaction with the Postgres session variable
 * `app.current_org_id` set via `set_config(..., true)` (the parameterized equivalent
 * of `SET LOCAL`) — this is what the Row-Level Security policies added in
 * `prisma/migrations/20260712000100_add_row_level_security/migration.sql` key off.
 *
 * `SET LOCAL` / `set_config(..., is_local => true)` scopes the setting to the current
 * transaction only, so it's automatically unset when the transaction ends — it can
 * never leak across requests sharing a connection from the pool. Every query that
 * touches a tenant-scoped table MUST go through this helper (using the `tx` it hands
 * you, not the top-level `prisma` client) or RLS will silently return zero rows.
 *
 * Login is the one deliberate exception (see src/lib/auth.ts) — organizationId isn't
 * known yet at that point, so that one query runs directly against `prisma`.
 */
export async function withOrgContext<T>(
  organizationId: string,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.current_org_id', ${organizationId}, true)`;
    return fn(tx);
  });
}
