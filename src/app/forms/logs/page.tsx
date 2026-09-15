import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { type OrgLogRow, OrgLogsClient } from '@/app/forms/logs/org-logs-client';
import { resolveAuditLogTargets } from '@/lib/audit-log-targets';
import { authOptions } from '@/lib/auth';
import { withOrgContext } from '@/lib/db';
import { requireOrganizationId } from '@/lib/session';
import { canManageUsers } from '@/lib/user-roles';

const LOGS_PAGE_LIMIT = 200;

/**
 * Org-scoped activity log ("Logs" in the sidebar's Admin section) — every action
 * logAudit() has recorded for this organisation, most recent first. Same admin-only
 * gate as /forms/users and /forms/organisation: a top-level nav item only Org super
 * admins (canManageUsers) see at all, not a page anyone else should be able to reach
 * directly either. Distinct from the platform-wide /admin/audit-log, which spans every
 * organisation and is gated by isPlatformAdmin instead.
 */
export default async function OrgLogsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect('/login');
  }

  if (!canManageUsers(session.user.role)) {
    redirect('/forms');
  }

  const { entries, targets } = await withOrgContext(session.user.organizationId, async (tx) => {
    const rows = await tx.auditLog.findMany({
      where: { organizationId: requireOrganizationId(session) },
      orderBy: { createdAt: 'desc' },
      take: LOGS_PAGE_LIMIT,
      select: {
        id: true,
        action: true,
        entityType: true,
        entityId: true,
        metadata: true,
        createdAt: true,
        actor: { select: { name: true, email: true } },
      },
    });

    // Resolves e.g. "form_version" -> the actual form's name, so the table can show
    // *which* form/response/user an entry was about instead of just a bare entity
    // type + opaque id. See resolveAuditLogTargets's doc comment for how.
    const targetLabels = await resolveAuditLogTargets(tx, requireOrganizationId(session), rows);

    return { entries: rows, targets: targetLabels };
  });

  const initialEntries: OrgLogRow[] = entries.map((entry) => ({
    id: entry.id,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId,
    target: targets.get(`${entry.entityType}:${entry.entityId}`) ?? null,
    metadata: (entry.metadata ?? {}) as Record<string, unknown>,
    createdAt: entry.createdAt.toISOString(),
    actorName: entry.actor?.name ?? entry.actor?.email ?? 'System',
  }));

  return <OrgLogsClient initialEntries={initialEntries} />;
}
