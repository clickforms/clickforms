import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { ChangePlanClient } from '@/app/forms/organisation/plan/change-plan-client';
import { authOptions } from '@/lib/auth';
import { loadBillingInfo } from '@/lib/billing/info';
import { getOrgPlanUsage } from '@/lib/billing/usage';
import { withOrgContext } from '@/lib/db';
import { requireOrganizationId } from '@/lib/session';
import { canManageUsers } from '@/lib/user-roles';

// Split out from the main Organisation > Billing tab (organisation-details-client.tsx)
// so an org that's already subscribed doesn't sit on a page that passively advertises
// cheaper/other tiers every time they check their usage — see the comment on
// org-plan-summary-actions in organisation-details-client.tsx. This page is the
// deliberate destination for "I want to change plan", not something shown by default.
interface ChangePlanPageProps {
  searchParams: Promise<{ interval?: string }>;
}

export default async function ChangePlanPage({ searchParams }: ChangePlanPageProps) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect('/login');
  }

  // Same admin-only gate as the parent Organisation settings page.
  if (!canManageUsers(session.user.role)) {
    redirect('/forms');
  }

  if (!session.user.organizationId) {
    redirect('/admin');
  }

  const query = await searchParams;

  const { plan, usage, billing } = await withOrgContext(session.user.organizationId, async (tx) => {
    const orgId = requireOrganizationId(session);
    const org = await tx.organization.findFirstOrThrow({
      where: { id: orgId },
      select: { plan: true, status: true, trialEndsAt: true, renewsAt: true },
    });

    // Same four numbers the Billing tab and /admin/billing show (see getOrgPlanUsage), so the
    // over-limit warning on this page can't disagree with what the org admin already saw.
    return {
      plan: org,
      usage: await getOrgPlanUsage(tx, orgId),
      billing: await loadBillingInfo(tx, orgId),
    };
  });

  return (
    <ChangePlanClient
      planInfo={{
        plan: plan.plan,
        status: plan.status,
        trialEndsAt: plan.trialEndsAt?.toISOString() ?? null,
        renewsAt: plan.renewsAt?.toISOString() ?? null,
        usage,
        billing,
      }}
      initialInterval={
        query.interval === 'year' || query.interval === 'month' ? query.interval : null
      }
    />
  );
}
