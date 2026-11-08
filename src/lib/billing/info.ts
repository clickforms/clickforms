import 'server-only';

import type { Prisma } from '@prisma/client';
import { getBillingAccess, graceDaysRemaining } from './status';
import { isStripeConfigured } from './stripe';
import type { BillingInfo, DiscountSummary } from './types';

/** Billing state for the organisation's own pages. Call inside withOrgContext. */
export async function loadBillingInfo(
  tx: Prisma.TransactionClient,
  organizationId: string,
): Promise<BillingInfo> {
  const org = await tx.organization.findUniqueOrThrow({
    where: { id: organizationId },
    select: {
      billingMode: true,
      plan: true,
      status: true,
      trialEndsAt: true,
      subscription: true,
    },
  });
  // A subscription that ended into the Free plan is history, not something to manage: the
  // customer-facing pages treat the organisation as simply being on Free.
  const sub =
    org.plan === 'free' && org.subscription?.stripeStatus === 'canceled' ? null : org.subscription;
  return {
    stripeEnabled: isStripeConfigured(),
    billingMode: org.billingMode,
    access: getBillingAccess(org, org.subscription),
    subscription: sub
      ? {
          stripeStatus: sub.stripeStatus,
          plan: sub.plan,
          interval: sub.interval,
          currentPeriodEnd: sub.currentPeriodEnd?.toISOString() ?? null,
          cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
          graceDaysLeft:
            sub.stripeStatus === 'past_due' ? graceDaysRemaining(sub.pastDueSince) : null,
          discount: (sub.discountSummary as DiscountSummary | null) ?? null,
        }
      : null,
  };
}
