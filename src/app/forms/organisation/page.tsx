import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { OrganisationDetailsClient } from '@/app/forms/organisation/organisation-details-client';
import { startOfCurrentMonth } from '@/lib/admin/plan-limits';
import { authOptions } from '@/lib/auth';
import { withOrgContext } from '@/lib/db';
import { createPresignedDownloadUrl } from '@/lib/s3';
import { requireOrganizationId } from '@/lib/session';
import { buildOrgOrigin } from '@/lib/tenant';
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

  // See the identical comment in src/app/forms/logs/page.tsx — fail closed rather than
  // let withOrgContext throw a raw error for a platform-only admin with no org.
  if (!session.user.organizationId) {
    redirect('/admin');
  }

  const { organization, usage } = await withOrgContext(session.user.organizationId, async (tx) => {
    const orgId = requireOrganizationId(session);
    const org = await tx.organization.findFirstOrThrow({
      where: { id: orgId },
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
        plan: true,
        status: true,
        trialEndsAt: true,
        renewsAt: true,
      },
    });

    // Same four numbers /admin/billing shows for this org, computed the same way
    // (buildUsageBars in plan-limits.ts) — an org admin sees exactly what a platform
    // admin would see for them, not a separately-derived approximation.
    const [formCount, userCount, orgFileSum, submissionFileSum, submissionCount] =
      await Promise.all([
        tx.form.count({ where: { organizationId: orgId } }),
        tx.user.count({ where: { organizationId: orgId } }),
        tx.organizationFile.aggregate({
          where: { organizationId: orgId },
          _sum: { sizeBytes: true },
        }),
        tx.submissionFile.aggregate({
          where: { organizationId: orgId },
          _sum: { sizeBytes: true },
        }),
        tx.submission.count({
          where: { organizationId: orgId, submittedAt: { gte: startOfCurrentMonth() } },
        }),
      ]);

    return {
      organization: org,
      usage: {
        forms: formCount,
        users: userCount,
        storageBytes: (orgFileSum._sum.sizeBytes ?? 0) + (submissionFileSum._sum.sizeBytes ?? 0),
        submissionsThisMonth: submissionCount,
      },
    };
  });

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
      plan={{
        plan: organization.plan,
        status: organization.status,
        trialEndsAt: organization.trialEndsAt?.toISOString() ?? null,
        renewsAt: organization.renewsAt?.toISOString() ?? null,
        usage,
      }}
      publicOrigin={buildOrgOrigin(organization.subdomain)}
    />
  );
}
