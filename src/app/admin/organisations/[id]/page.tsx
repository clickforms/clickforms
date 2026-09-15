import { notFound, redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import {
  type AdminOrgPendingInvite,
  type AdminOrgUser,
  OrganisationDetailAdminClient,
} from '@/app/admin/organisations/[id]/organisation-detail-admin-client';
import { authOptions } from '@/lib/auth';
import { withOrgContext } from '@/lib/db';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminOrganisationDetailPage({ params }: PageProps) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isPlatformAdmin) {
    redirect('/forms');
  }

  const { id } = await params;

  const result = await withOrgContext(id, async (tx) => {
    const organization = await tx.organization.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        subdomain: true,
        abn: true,
        contactName: true,
        contactEmail: true,
        contactPhone: true,
        plan: true,
        status: true,
        createdAt: true,
      },
    });
    if (!organization) return null;

    const [users, pendingInvites, formCount, submissionCount] = await Promise.all([
      tx.user.findMany({
        where: { organizationId: id },
        orderBy: { createdAt: 'asc' },
        select: { id: true, name: true, email: true, role: true, createdAt: true },
      }),
      tx.userInvite.findMany({
        where: { organizationId: id, acceptedAt: null, expiresAt: { gt: new Date() } },
        orderBy: { createdAt: 'desc' },
        select: { id: true, email: true, name: true, role: true, expiresAt: true, createdAt: true },
      }),
      tx.form.count({ where: { organizationId: id } }),
      tx.submission.count({ where: { organizationId: id } }),
    ]);

    return { organization, users, pendingInvites, formCount, submissionCount };
  });

  if (!result) {
    notFound();
  }

  const users: AdminOrgUser[] = result.users.map((user) => ({
    ...user,
    createdAt: user.createdAt.toISOString(),
  }));
  const pendingInvites: AdminOrgPendingInvite[] = result.pendingInvites.map((invite) => ({
    ...invite,
    createdAt: invite.createdAt.toISOString(),
    expiresAt: invite.expiresAt.toISOString(),
  }));
  const organization = {
    ...result.organization,
    createdAt: result.organization.createdAt.toISOString(),
  };

  return (
    <OrganisationDetailAdminClient
      initialOrganization={organization}
      initialUsers={users}
      initialPendingInvites={pendingInvites}
      initialFormCount={result.formCount}
      initialSubmissionCount={result.submissionCount}
    />
  );
}
