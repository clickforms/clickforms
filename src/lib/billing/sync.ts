import 'server-only';

import { type BillingInterval, type OrgPlan, Prisma } from '@prisma/client';
import type Stripe from 'stripe';
import { prisma, withOrgContext } from '@/lib/db';
import { log } from '@/lib/log';
import { parsePriceLookupKey } from './config';
import { accessForStripeStatus } from './status';
import { getStripe } from './stripe';
import type { DiscountSummary } from './types';

// Mirrors a Stripe subscription into Postgres. Called from the webhook handler (and from
// Checkout's success path as a safety net). Stripe remains the source of truth: every call
// re-fetches the subscription instead of trusting the (possibly out-of-order) event payload.

export function discountSummaryFrom(
  discount: Stripe.Discount | undefined,
  coupon: Stripe.Coupon | null,
): DiscountSummary | null {
  if (!discount || !coupon) return null;
  return {
    name: coupon.name,
    percentOff: coupon.percent_off,
    amountOff: coupon.amount_off,
    currency: coupon.currency,
    endsAt: discount.end ? new Date(discount.end * 1000).toISOString() : null,
  };
}

async function loadDiscountSummary(
  stripe: Stripe,
  subscription: Stripe.Subscription,
): Promise<DiscountSummary | null> {
  const discount = subscription.discounts.find(
    (entry): entry is Stripe.Discount => typeof entry !== 'string',
  );
  const couponRef = discount?.source.coupon;
  if (!discount || !couponRef) return null;
  const coupon =
    typeof couponRef === 'string' ? await stripe.coupons.retrieve(couponRef) : couponRef;
  return discountSummaryFrom(discount, coupon);
}

export interface SyncResult {
  organizationId: string;
  stripeStatus: string;
  /** False when the event was for a superseded subscription and was ignored. */
  applied: boolean;
}

/** Re-reads the subscription from Stripe and writes it (plus the organisation's billing
 * fields) to Postgres. Returns null when the subscription isn't linked to an organisation. */
export async function syncSubscriptionById(subscriptionId: string): Promise<SyncResult | null> {
  const stripe = getStripe();
  const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
    expand: ['discounts'],
  });

  const organizationId = subscription.metadata.organizationId;
  if (!organizationId) {
    log.warn('billing.subscription_without_organisation', { subscriptionId: subscription.id });
    return null;
  }

  const item = subscription.items.data[0];
  const parsed =
    parsePriceLookupKey(item?.price.lookup_key) ??
    parsePriceLookupKey(
      subscription.metadata.plan && subscription.metadata.interval
        ? `${subscription.metadata.plan}_${subscription.metadata.interval === 'year' ? 'annual' : 'monthly'}`
        : null,
    );
  const periodEnd = item?.current_period_end ? new Date(item.current_period_end * 1000) : null;
  const customerId =
    typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id;
  const discountSummary = await loadDiscountSummary(stripe, subscription);
  const incomingAccess = accessForStripeStatus(subscription.status);

  return withOrgContext(organizationId, async (tx) => {
    const organization = await tx.organization.findUnique({
      where: { id: organizationId },
      select: { status: true, plan: true },
    });
    if (!organization) {
      log.warn('billing.organisation_not_found', {
        organizationId,
        subscriptionId: subscription.id,
      });
      return null;
    }

    const existing = await tx.orgSubscription.findUnique({ where: { organizationId } });

    // An out-of-order event for an old, canceled subscription must not clobber the live one
    // the organisation has since moved to.
    if (
      existing &&
      existing.stripeSubscriptionId !== subscription.id &&
      incomingAccess === 'read_only' &&
      accessForStripeStatus(existing.stripeStatus) !== 'read_only'
    ) {
      return { organizationId, stripeStatus: subscription.status, applied: false };
    }

    // A subscription that has ended (cancelled) drops the organisation to the Free plan.
    const plan: OrgPlan =
      subscription.status === 'canceled'
        ? 'free'
        : (parsed?.plan ?? existing?.plan ?? organization.plan);
    const interval: BillingInterval = parsed?.interval ?? existing?.interval ?? 'month';
    const pastDueSince =
      subscription.status === 'past_due' ? (existing?.pastDueSince ?? new Date()) : null;

    const data = {
      stripeSubscriptionId: subscription.id,
      stripeStatus: subscription.status,
      plan,
      interval,
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      pastDueSince,
      // JsonNull clears a stale discount instead of leaving the previous one in place.
      discountSummary: discountSummary
        ? (discountSummary as unknown as Prisma.InputJsonValue)
        : Prisma.JsonNull,
    };
    await tx.orgSubscription.upsert({
      where: { organizationId },
      create: { organizationId, ...data },
      update: data,
    });

    await tx.organization.update({
      where: { id: organizationId },
      data: {
        billingMode: 'stripe',
        stripeCustomerId: customerId,
        plan,
        renewsAt: periodEnd,
        // A trial organisation that has paid (or is mid-retry) becomes a normal active one.
        // Suspended stays suspended: that is a deliberate platform-admin action.
        ...(incomingAccess !== 'read_only' && organization.status === 'trial'
          ? { status: 'active' as const, trialEndsAt: null }
          : {}),
      },
    });

    return { organizationId, stripeStatus: subscription.status, applied: true };
  }).then(async (result) => {
    // Record admin-granted discounts that Checkout has now redeemed.
    if (result?.applied) {
      await markAppliedGrants(organizationId, couponIdsOn(subscription));
    }
    return result;
  });
}

/** Marks pending admin grants as applied once their coupon shows up on the subscription, so
 * a Checkout redemption is recorded without extra plumbing. */
async function markAppliedGrants(
  organizationId: string,
  appliedCouponIds: string[],
): Promise<void> {
  if (appliedCouponIds.length === 0) return;
  await prisma.billingDiscountGrant.updateMany({
    where: {
      organizationId,
      appliedAt: null,
      revokedAt: null,
      stripeCouponId: { in: appliedCouponIds },
    },
    data: { appliedAt: new Date() },
  });
}

function couponIdsOn(subscription: Stripe.Subscription): string[] {
  const ids: string[] = [];
  for (const entry of subscription.discounts) {
    if (typeof entry === 'string') continue;
    const coupon = entry.source.coupon;
    const id = typeof coupon === 'string' ? coupon : coupon?.id;
    if (id) ids.push(id);
  }
  return ids;
}
