import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { BillingAdminClient, type BillingOrgRow } from '@/app/admin/billing/billing-admin-client';
import { startOfCurrentMonth } from '@/lib/admin/plan-limits';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

export default async function AdminBillingPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isPlatformAdmin) {
    redirect('/forms');
  }

  const organizations = await prisma.organization.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      subdomain: true,
      plan: true,
      status: true,
      trialEndsAt: true,
      renewsAt: true,
    },
  });

  const orgIds = organizations.map((org) => org.id);
  const [formCounts, userCounts, orgFileSums, submissionFileSums, submissionCounts] =
    await Promise.all([
      prisma.form.groupBy({
        by: ['organizationId'],
        where: { organizationId: { in: orgIds } },
        _count: { _all: true },
      }),
      prisma.user.groupBy({
        by: ['organizationId'],
        where: { organizationId: { in: orgIds } },
        _count: { _all: true },
      }),
      prisma.organizationFile.groupBy({
        by: ['organizationId'],
        where: { organizationId: { in: orgIds } },
        _sum: { sizeBytes: true },
      }),
      prisma.submissionFile.groupBy({
        by: ['organizationId'],
        where: { organizationId: { in: orgIds } },
        _sum: { sizeBytes: true },
      }),
      // gte on a nullable column (submittedAt) already excludes still-in-progress
      // (unsubmitted) rows — no separate `not: null` filter needed.
      prisma.submission.groupBy({
        by: ['organizationId'],
        where: { organizationId: { in: orgIds }, submittedAt: { gte: startOfCurrentMonth() } },
        _count: { _all: true },
      }),
    ]);

  const formCountByOrg = new Map(formCounts.map((row) => [row.organizationId, row._count._all]));
  const userCountByOrg = new Map(userCounts.map((row) => [row.organizationId, row._count._all]));
  const orgFileBytesByOrg = new Map(
    orgFileSums.map((row) => [row.organizationId, row._sum.sizeBytes ?? 0]),
  );
  const submissionFileBytesByOrg = new Map(
    submissionFileSums.map((row) => [row.organizationId, row._sum.sizeBytes ?? 0]),
  );
  const submissionCountByOrg = new Map(
    submissionCounts.map((row) => [row.organizationId, row._count._all]),
  );

  const initialOrganizations: BillingOrgRow[] = organizations.map((org) => ({
    id: org.id,
    name: org.name,
    subdomain: org.subdomain,
    plan: org.plan,
    status: org.status,
    trialEndsAt: org.trialEndsAt?.toISOString() ?? null,
    renewsAt: org.renewsAt?.toISOString() ?? null,
    usage: {
      forms: formCountByOrg.get(org.id) ?? 0,
      users: userCountByOrg.get(org.id) ?? 0,
      storageBytes:
        (orgFileBytesByOrg.get(org.id) ?? 0) + (submissionFileBytesByOrg.get(org.id) ?? 0),
      submissionsThisMonth: submissionCountByOrg.get(org.id) ?? 0,
    },
  }));

  return <BillingAdminClient initialOrganizations={initialOrganizations} />;
}
