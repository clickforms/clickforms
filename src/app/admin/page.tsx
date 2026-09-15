import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { AdminHomeClient } from '@/app/admin/admin-home-client';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

export default async function AdminIndexPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isPlatformAdmin) {
    redirect('/forms');
  }

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [
    user,
    organizationCount,
    userCount,
    formCount,
    submissionCountThisMonth,
    organizations,
    recentActivity,
  ] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { name: true, email: true },
    }),
    prisma.organization.count(),
    prisma.user.count({ where: { organization: { is: {} } } }),
    prisma.form.count(),
    prisma.submission.count({ where: { createdAt: { gte: startOfMonth } } }),
    prisma.organization.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: { id: true, name: true, subdomain: true, createdAt: true },
    }),
    // Cross-org, most-recent-first — same "plain prisma client, no single org to scope
    // by" exception as the rest of /admin (see src/lib/db.ts withOrgContext doc comment).
    prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        action: true,
        entityType: true,
        createdAt: true,
        organization: { select: { name: true } },
        actor: { select: { name: true, email: true } },
      },
    }),
  ]);

  const orgIds = organizations.map((org) => org.id);
  const [userCounts, formCounts] = await Promise.all([
    prisma.user.groupBy({
      by: ['organizationId'],
      where: { organizationId: { in: orgIds } },
      _count: { _all: true },
    }),
    prisma.form.groupBy({
      by: ['organizationId'],
      where: { organizationId: { in: orgIds } },
      _count: { _all: true },
    }),
  ]);

  const userCountByOrg = new Map(userCounts.map((row) => [row.organizationId, row._count._all]));
  const formCountByOrg = new Map(formCounts.map((row) => [row.organizationId, row._count._all]));

  const displayName =
    user?.name?.trim() ||
    user?.email?.split('@')[0] ||
    session.user.email?.split('@')[0] ||
    'there';

  return (
    <AdminHomeClient
      displayName={displayName}
      stats={{ organizationCount, userCount, formCount, submissionCountThisMonth }}
      recentOrganizations={organizations.map((org) => ({
        id: org.id,
        name: org.name,
        subdomain: org.subdomain,
        createdAt: org.createdAt.toISOString(),
        userCount: userCountByOrg.get(org.id) ?? 0,
        formCount: formCountByOrg.get(org.id) ?? 0,
      }))}
      recentActivity={recentActivity.map((entry) => ({
        id: entry.id,
        action: entry.action,
        entityType: entry.entityType,
        createdAt: entry.createdAt.toISOString(),
        organizationName: entry.organization?.name ?? null,
        actorName: entry.actor?.name ?? entry.actor?.email ?? null,
      }))}
    />
  );
}
