import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import {
  AuditLogAdminClient,
  type AuditLogRow,
} from '@/app/admin/audit-log/audit-log-admin-client';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

const AUDIT_LOG_PAGE_LIMIT = 200;

export default async function AdminAuditLogPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isPlatformAdmin) {
    redirect('/forms');
  }

  const entries = await prisma.auditLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: AUDIT_LOG_PAGE_LIMIT,
    select: {
      id: true,
      action: true,
      entityType: true,
      entityId: true,
      createdAt: true,
      metadata: true,
      organization: { select: { id: true, name: true } },
      actor: { select: { name: true, email: true } },
    },
  });

  const initialEntries: AuditLogRow[] = entries.map((entry) => ({
    id: entry.id,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId,
    createdAt: entry.createdAt.toISOString(),
    organizationId: entry.organization?.id ?? null,
    organizationName: entry.organization?.name ?? '—',
    actorName: entry.actor?.name ?? entry.actor?.email ?? 'System',
  }));

  return <AuditLogAdminClient initialEntries={initialEntries} />;
}
