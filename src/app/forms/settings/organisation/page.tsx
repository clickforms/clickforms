import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { OrganisationDetailsClient } from '@/app/forms/settings/organisation/organisation-details-client';
import { authOptions } from '@/lib/auth';
import { withOrgContext } from '@/lib/db';
import { canManageUsers } from '@/lib/user-roles';

export default async function OrganisationSettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect('/login');
  }

  // Same admin-only gate as /forms/users — org-wide details aren't a per-user setting.
  if (!canManageUsers(session.user.role)) {
    redirect('/forms/settings/user-details');
  }

  const organization = await withOrgContext(session.user.organizationId, (tx) =>
    tx.organization.findFirstOrThrow({
      where: { id: session.user.organizationId },
      select: {
        id: true,
        name: true,
        subdomain: true,
        abn: true,
        contactName: true,
        contactEmail: true,
        contactPhone: true,
      },
    }),
  );

  return <OrganisationDetailsClient initialOrganization={organization} />;
}
