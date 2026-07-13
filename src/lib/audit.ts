import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';

interface LogAuditParams {
  organizationId: string;
  /** Null for public/unauthenticated actions (e.g. a respondent submitting a form). */
  actorUserId?: string | null;
  /** Short, stable, machine-parseable verb, e.g. "form.publish", "submission.approve". */
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown>;
}

/**
 * Single audit-logging entry point (specs/01-data-model-and-auth.md) — every mutating
 * route calls this rather than writing to `audit_log` directly, so logging behavior
 * (shape, org-scoping) stays consistent as more routes are added in specs 02-06.
 *
 * Pass the transaction client from `withOrgContext` when logging alongside a
 * tenant-scoped write, so the audit row is covered by the same RLS-scoped transaction
 * as the change it's describing. Falls back to the top-level `prisma` client for
 * call sites that already have an organizationId but aren't inside a transaction.
 */
export async function logAudit(
  params: LogAuditParams,
  client: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<void> {
  await client.auditLog.create({
    data: {
      organizationId: params.organizationId,
      actorUserId: params.actorUserId ?? null,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      metadata: (params.metadata ?? {}) as Prisma.InputJsonValue,
    },
  });
}
