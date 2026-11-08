import type { BillingMode, OrgPlan, OrgStatus } from '@prisma/client';

// Pure (no server-only imports) so client components and unit tests can use it.
// Maps Stripe's subscription status to what an organisation may do. See specs/08-billing.md,
// "Status mapping and enforcement".

/**
 * - `full`: everything works.
 * - `grace`: a payment failed but Stripe is still retrying (Smart Retries, ~14 days). Everything
 *   still works; the org sees a banner and gets emails.
 * - `read_only`: no creating or editing forms, users or files. Viewing, exporting and public form
 *   submissions keep working.
 */
export type BillingAccess = 'full' | 'grace' | 'read_only';

export function accessForStripeStatus(stripeStatus: string): BillingAccess {
  switch (stripeStatus) {
    case 'active':
    case 'trialing':
      return 'full';
    case 'past_due':
    case 'incomplete':
      return 'grace';
    default:
      // unpaid, canceled, incomplete_expired, paused, or anything Stripe adds later:
      // fail closed to read-only rather than silently granting access.
      return 'read_only';
  }
}

interface OrgBillingInput {
  billingMode: BillingMode;
  /** Needed to tell a lapsed paid subscription from one that ended into the Free plan. */
  plan?: OrgPlan;
  status: OrgStatus;
  trialEndsAt: Date | null;
}

/**
 * What the organisation may do right now.
 *
 * Manual-billing orgs (everyone before Stripe, plus Enterprise) keep the original behaviour:
 * only an expired trial restricts them. Stripe-billed orgs follow their subscription; before
 * they have one they are still on the free trial.
 */
export function getBillingAccess(
  org: OrgBillingInput,
  subscription: { stripeStatus: string } | null,
  now: Date = new Date(),
): BillingAccess {
  const trialExpired =
    org.status === 'trial' && org.trialEndsAt !== null && org.trialEndsAt.getTime() < now.getTime();

  if (org.billingMode === 'stripe' && subscription) {
    // A subscription that ended on purpose (cancelled, then dropped to Free by the sync) is
    // not a lapse: the organisation continues on the Free plan's limits with full access.
    if (subscription.stripeStatus === 'canceled' && org.plan === 'free') return 'full';
    return accessForStripeStatus(subscription.stripeStatus);
  }
  return trialExpired ? 'read_only' : 'full';
}

/** How many whole days remain of a grace period that began at `since`. */
export function graceDaysRemaining(since: Date | null, graceDays = 14, now: Date = new Date()) {
  if (!since) return null;
  const end = since.getTime() + graceDays * 24 * 60 * 60 * 1000;
  return Math.max(0, Math.ceil((end - now.getTime()) / (24 * 60 * 60 * 1000)));
}
