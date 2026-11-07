import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { OrganisationDetailsClient } from '@/app/forms/organisation/organisation-details-client';
import { authOptions } from '@/lib/auth';
import { syncAfterCheckout } from '@/lib/billing/checkout-sync';
import { loadBillingInfo } from '@/lib/billing/info';
import { isStripeConfigured } from '@/lib/billing/stripe';
import { getOrgPlanUsage } from '@/lib/billing/usage';
import { withOrgContext } from '@/lib/db';
import { parsePreheader } from '@/lib/org-preheader';
import { createPresignedDownloadUrl } from '@/lib/s3';
import { requireOrganizationId } from '@/lib/session';
import { buildOrgOrigin } from '@/lib/tenant';
import { canManageUsers } from '@/lib/user-roles';

interface OrganisationSettingsPageProps {
  searchParams: Promise<{ billing?: string; session_id?: string }>;
}

export default async function OrganisationSettingsPage({
  searchParams,
}: OrganisationSettingsPageProps) {
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

  // Back from Stripe Checkout: make sure the new subscription is recorded before we render, so
  // the page shows the plan they just bought even if the webhook is a few seconds behind.
  const query = await searchParams;
  if (query.billing === 'success' && query.session_id && isStripeConfigured()) {
    await syncAfterCheckout(session.user.organizationId, query.session_id);
  }

  const { organization, usage, billing } = await withOrgContext(
    session.user.organizationId,
    async (tx) => {
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
          preheader: true,
          plan: true,
          status: true,
          trialEndsAt: true,
          renewsAt: true,
        },
      });

      // Same four numbers /admin/billing shows for this org, computed the same way
      // (buildUsageBars in plan-limits.ts) — an org admin sees exactly what a platform
      // admin would see for them, not a separately-derived approximation.
      return {
        organization: org,
        usage: await getOrgPlanUsage(tx, orgId),
        billing: await loadBillingInfo(tx, orgId),
      };
    },
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

  const preheader = parsePreheader(organization.preheader);
  let preheaderLogoUrl: string | null = null;
  if (preheader?.logoStorageKey) {
    try {
      preheaderLogoUrl = await createPresignedDownloadUrl({
        storageKey: preheader.logoStorageKey,
        filename: 'logo',
        inline: true,
      });
    } catch {
      // Soft-fail, same as the workspace logo above.
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
        preheader,
        preheaderLogoUrl,
      }}
      plan={{
        plan: organization.plan,
        status: organization.status,
        trialEndsAt: organization.trialEndsAt?.toISOString() ?? null,
        renewsAt: organization.renewsAt?.toISOString() ?? null,
        usage,
        billing,
      }}
      publicOrigin={buildOrgOrigin(organization.subdomain)}
    />
  );
}
