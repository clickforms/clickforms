import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import {
  OrganisationsListClient,
  type OrganizationRow,
} from '@/app/admin/organisations/organisations-list-client';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

export default async function AdminOrganisationsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isPlatformAdmin) {
    redirect('/forms');
  }

  const organizations = await prisma.organization.findMany({
    orderBy: { createdAt: 'desc' },
    select: { id: true, name: true, subdomain: true, plan: true, status: true, createdAt: true },
  });

  const [userCounts, formCounts] = await Promise.all([
    prisma.user.groupBy({ by: ['organizationId'], _count: { _all: true } }),
    prisma.form.groupBy({ by: ['organizationId'], _count: { _all: true } }),
  ]);
  const userCountByOrg = new Map(userCounts.map((row) => [row.organizationId, row._count._all]));
  const formCountByOrg = new Map(formCounts.map((row) => [row.organizationId, row._count._all]));

  const initialOrganizations: OrganizationRow[] = organizations.map((org) => ({
    id: org.id,
    name: org.name,
    subdomain: org.subdomain,
    plan: org.plan,
    status: org.status,
    createdAt: org.createdAt.toISOString(),
    userCount: userCountByOrg.get(org.id) ?? 0,
    formCount: formCountByOrg.get(org.id) ?? 0,
  }));

  return <OrganisationsListClient initialOrganizations={initialOrganizations} />;
}
