import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { OrganisationDetailsClient } from '@/app/forms/organisation/organisation-details-client';
import { authOptions } from '@/lib/auth';
import { withOrgContext } from '@/lib/db';
import { createPresignedDownloadUrl } from '@/lib/s3';
import { canManageUsers } from '@/lib/user-roles';

export default async function OrganisationSettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect('/login');
  }

  // Same admin-only gate as /forms/users — a top-level nav item, not a personal-settings
  // sub-page, so a non-admin who lands here directly bounces to the dashboard like
  // /forms/users does, rather than into the (now unrelated) personal settings area.
  if (!canManageUsers(session.user.role)) {
    redirect('/forms');
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
        notificationEmail: true,
        logoStorageKey: true,
      },
    }),
  );

  let logoUrl: string | null = null;
  if (organization.logoStorageKey) {
    try {
      logoUrl = await createPresignedDownloadUrl({
        storageKey: organization.logoStorageKey,
        filename: 'logo',
        inline: true,
      });
    } catch {
      // Same soft-fail posture as elsewhere — a missing S3_BUCKET in local dev
      // shouldn't break the whole settings page, just the logo preview.
    }
  }

  return (
    <OrganisationDetailsClient
      initialOrganization={{
        id: organization.id,
        name: organization.name,
        subdomain: organization.subdomain,
        abn: organization.abn,
        contactName: organization.contactName,
        contactEmail: organization.contactEmail,
        contactPhone: organization.contactPhone,
        notificationEmail: organization.notificationEmail,
        logoUrl,
      }}
    />
  );
}
