import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { ChangePlanClient } from '@/app/forms/organisation/plan/change-plan-client';
import { startOfCurrentMonth } from '@/lib/admin/plan-limits';
import { authOptions } from '@/lib/auth';
import { withOrgContext } from '@/lib/db';
import { requireOrganizationId } from '@/lib/session';
import { canManageUsers } from '@/lib/user-roles';

// Split out from the main Organisation > Billing tab (organisation-details-client.tsx)
// so an org that's already subscribed doesn't sit on a page that passively advertises
// cheaper/other tiers every time they check their usage — see the comment on
// org-plan-summary-actions in organisation-details-client.tsx. This page is the
// deliberate destination for "I want to change plan", not something shown by default.
export default async function ChangePlanPage() {
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

  const { plan, usage } = await withOrgContext(session.user.organizationId, async (tx) => {
    const orgId = requireOrganizationId(session);
    const org = await tx.organization.findFirstOrThrow({
      where: { id: orgId },
      select: { plan: true, status: true, trialEndsAt: true, renewsAt: true },
    });

    // Same four numbers the Billing tab and /admin/billing show — computed the same way
    // (buildUsageBars in plan-limits.ts) so the over-limit warning on this page can't
    // disagree with what the org admin already saw on the Billing tab.
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
      plan: org,
      usage: {
        forms: formCount,
        users: userCount,
        storageBytes: (orgFileSum._sum.sizeBytes ?? 0) + (submissionFileSum._sum.sizeBytes ?? 0),
        submissionsThisMonth: submissionCount,
      },
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
      }}
    />
  );
}
