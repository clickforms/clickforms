import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import {
  type BillingActivityItem,
  BillingAdminClient,
  type BillingOverviewRow,
} from '@/app/admin/billing/billing-admin-client';
import { buildUsageBars, type PlanUsageBar, startOfCurrentMonth } from '@/lib/admin/plan-limits';
import { authOptions } from '@/lib/auth';
import {
  attentionFor,
  BILLING_ACTIVITY_ACTIONS,
  billingStateFor,
  describeBillingAction,
  monthlyRevenueCents,
} from '@/lib/billing/overview';
import type { DiscountSummary } from '@/lib/billing/types';
import { prisma } from '@/lib/db';

function describeDiscount(discount: DiscountSummary | null): string | null {
  if (!discount) return null;
  if (discount.percentOff !== null) return `${discount.percentOff}% off`;
  if (discount.amountOff !== null) return `$${(discount.amountOff / 100).toFixed(2)} off`;
  return 'Discounted';
}

/** The most-used resource of an organisation, so one glanceable bar can stand for all four. */
function worstUsage(bars: PlanUsageBar[]): { label: string; percent: number } | null {
  let worst: { label: string; percent: number } | null = null;
  for (const bar of bars) {
    if (bar.limit === null || bar.limit === 0) continue;
    const percent = Math.round((bar.used / bar.limit) * 100);
    if (!worst || percent > worst.percent) {
      worst = { label: bar.label.replace(' this month', ''), percent };
    }
  }
  return worst;
}

export default async function AdminBillingPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isPlatformAdmin) {
    redirect('/forms');
  }

  const now = new Date();
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
      billingMode: true,
      subscription: {
        select: {
          stripeStatus: true,
          plan: true,
          interval: true,
          currentPeriodEnd: true,
          cancelAtPeriodEnd: true,
          pastDueSince: true,
          discountSummary: true,
        },
      },
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
      // (unsubmitted) rows, no separate `not: null` filter needed.
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

  const rows: BillingOverviewRow[] = organizations.map((org) => {
    const subscription = org.billingMode === 'stripe' ? org.subscription : null;
    const state = billingStateFor(
      {
        status: org.status,
        trialEndsAt: org.trialEndsAt,
        billingMode: org.billingMode,
        stripeStatus: subscription?.stripeStatus ?? null,
      },
      now,
    );
    // The plan Stripe is billing for, falling back to the organisation's own plan.
    const plan = subscription?.plan ?? org.plan;
    const discount = (subscription?.discountSummary as DiscountSummary | null) ?? null;

    const bars = buildUsageBars(plan, {
      forms: formCountByOrg.get(org.id) ?? 0,
      users: userCountByOrg.get(org.id) ?? 0,
      storageBytes:
        (orgFileBytesByOrg.get(org.id) ?? 0) + (submissionFileBytesByOrg.get(org.id) ?? 0),
      submissionsThisMonth: submissionCountByOrg.get(org.id) ?? 0,
    });
    const overLimit = bars
      .filter((bar) => bar.limit !== null && bar.used > bar.limit)
      .map((bar) => bar.label.replace(' this month', ''));
    const nearLimit = bars
      .filter((bar) => bar.percent !== null && bar.percent >= 90 && !overLimit.includes(bar.label))
      .map((bar) => bar.label.replace(' this month', ''));

    const periodEnd = subscription?.currentPeriodEnd ?? org.renewsAt;
    const isPaying = state === 'subscribed' || state === 'past_due';
    return {
      id: org.id,
      name: org.name,
      subdomain: org.subdomain,
      plan,
      state,
      interval: subscription?.interval ?? null,
      mrrCents:
        isPaying && subscription
          ? monthlyRevenueCents(plan, subscription.interval, discount, now)
          : 0,
      discountLabel: describeDiscount(discount),
      date:
        state === 'trial' || state === 'trial_expired'
          ? (org.trialEndsAt?.toISOString() ?? null)
          : (periodEnd?.toISOString() ?? null),
      cancelAtPeriodEnd: subscription?.cancelAtPeriodEnd ?? false,
      attention: attentionFor(
        {
          state,
          trialEndsAt: org.trialEndsAt,
          pastDueSince: subscription?.pastDueSince ?? null,
          cancelAtPeriodEnd: subscription?.cancelAtPeriodEnd ?? false,
          periodEnd,
          overLimit,
        },
        now,
      ),
      overLimit,
      nearLimit,
      topUsage: worstUsage(bars),
    };
  });

  const activityEntries = await prisma.auditLog.findMany({
    where: { action: { in: [...BILLING_ACTIVITY_ACTIONS] } },
    orderBy: { createdAt: 'desc' },
    take: 8,
    select: {
      id: true,
      action: true,
      metadata: true,
      createdAt: true,
      organization: { select: { id: true, name: true } },
      actor: { select: { name: true, email: true } },
    },
  });
  const activity: BillingActivityItem[] = activityEntries.map((entry) => ({
    id: entry.id,
    text: describeBillingAction(entry.action, entry.metadata),
    organizationId: entry.organization?.id ?? null,
    organizationName: entry.organization?.name ?? 'Unknown organisation',
    actor: entry.actor?.name ?? entry.actor?.email ?? 'System',
    at: entry.createdAt.toISOString(),
  }));

  return <BillingAdminClient rows={rows} activity={activity} />;
}
