import type { BillingInterval, OrgPlan, OrgStatus } from '@prisma/client';
import { PLAN_PRICING } from '@/lib/admin/plan-limits';
import { accessForStripeStatus } from '@/lib/billing/status';
import type { DiscountSummary } from './types';

// Pure rules behind the platform-admin Billing overview (/admin/billing): which billing state
// an organisation is in, what it contributes to MRR, and why it might need attention.

export type BillingState =
  | 'subscribed' // paying through Stripe, in good standing
  | 'past_due' // Stripe payment failing, inside the grace period
  | 'ended' // Stripe subscription canceled or unpaid: read-only
  | 'trial'
  | 'trial_expired'
  | 'manual' // active but billed by hand, not on Stripe yet
  | 'suspended';

export interface BillingStateInput {
  status: OrgStatus;
  trialEndsAt: Date | null;
  billingMode: 'manual' | 'stripe';
  stripeStatus: string | null;
}

export function billingStateFor(org: BillingStateInput, now: Date): BillingState {
  if (org.status === 'suspended') return 'suspended';
  if (org.billingMode === 'stripe' && org.stripeStatus) {
    const access = accessForStripeStatus(org.stripeStatus);
    if (access === 'full') return 'subscribed';
    if (access === 'grace') return 'past_due';
    return 'ended';
  }
  if (org.status === 'trial') {
    return org.trialEndsAt && org.trialEndsAt.getTime() < now.getTime() ? 'trial_expired' : 'trial';
  }
  return 'manual';
}

/** Monthly recurring revenue in cents for one Stripe subscription: the list price per month
 * (annual plans are their yearly total divided by 12) less any discount still running. GST
 * inclusive, like every price we show. Enterprise has no list price, so it counts as 0. */
export function monthlyRevenueCents(
  plan: OrgPlan,
  interval: BillingInterval,
  discount: Pick<DiscountSummary, 'percentOff' | 'amountOff' | 'endsAt'> | null,
  now: Date,
): number {
  const price = PLAN_PRICING[plan];
  const perMonth = interval === 'year' ? price.annual : price.monthly;
  if (perMonth === null) return 0;
  let cents = Math.round(perMonth * 100);

  const discountActive = discount && (!discount.endsAt || new Date(discount.endsAt) > now);
  if (discount && discountActive) {
    if (discount.percentOff) {
      cents = Math.round(cents * (1 - discount.percentOff / 100));
    } else if (discount.amountOff) {
      // A fixed amount is taken off each invoice, so spread it over the months it covers.
      cents -= interval === 'year' ? Math.round(discount.amountOff / 12) : discount.amountOff;
    }
  }
  return Math.max(0, cents);
}

/** Audit-log actions that belong in the billing activity feed. */
export const BILLING_ACTIVITY_ACTIONS = [
  'admin.billing.invoice_retry',
  'admin.billing.invoice_retry_failed',
  'admin.billing.invoice_void',
  'admin.billing.invoice_mark_paid',
  'admin.billing.subscription_cancel_at_period_end',
  'admin.billing.subscription_resume',
  'admin.billing.subscription_cancel_now',
  'admin.billing.discount_grant',
  'admin.billing.discount_revoke',
  'organization.plan_change',
] as const;

/** One-line, past-tense description of a billing audit entry for the activity feed. */
export function describeBillingAction(action: string, metadata: unknown): string {
  const label =
    metadata && typeof metadata === 'object' && 'label' in metadata
      ? String((metadata as { label: unknown }).label)
      : null;
  switch (action) {
    case 'admin.billing.invoice_retry':
      return 'Retried a failed payment';
    case 'admin.billing.invoice_retry_failed':
      return 'Retried a payment, but the card was declined';
    case 'admin.billing.invoice_void':
      return 'Voided an invoice';
    case 'admin.billing.invoice_mark_paid':
      return 'Marked an invoice as paid';
    case 'admin.billing.subscription_cancel_at_period_end':
      return 'Scheduled the subscription to cancel';
    case 'admin.billing.subscription_resume':
      return 'Resumed the subscription';
    case 'admin.billing.subscription_cancel_now':
      return 'Canceled the subscription immediately';
    case 'admin.billing.discount_grant':
      return label ? `Granted ${label}` : 'Granted a discount';
    case 'admin.billing.discount_revoke':
      return label ? `Revoked ${label}` : 'Revoked a discount';
    case 'organization.plan_change':
      return 'Changed plan';
    default:
      return action;
  }
}

export type AttentionSeverity = 'urgent' | 'warning';

export interface Attention {
  severity: AttentionSeverity;
  message: string;
}

export interface AttentionInput {
  state: BillingState;
  trialEndsAt: Date | null;
  pastDueSince: Date | null;
  cancelAtPeriodEnd: boolean;
  periodEnd: Date | null;
  /** Labels of plan limits the organisation is currently over, e.g. ["Forms"]. */
  overLimit: string[];
}

function wholeDays(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / 86_400_000);
}

function shortDate(date: Date): string {
  return date.toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/** The single most important thing to act on for an organisation, or null if all is well. */
export function attentionFor(input: AttentionInput, now: Date): Attention | null {
  switch (input.state) {
    case 'past_due': {
      const days = input.pastDueSince ? Math.max(0, wholeDays(input.pastDueSince, now)) : null;
      return {
        severity: 'urgent',
        message:
          days === null
            ? 'Payment failed.'
            : days === 0
              ? 'Payment failed today.'
              : `Payment failing for ${days} ${days === 1 ? 'day' : 'days'}.`,
      };
    }
    case 'ended':
      return { severity: 'urgent', message: 'Subscription ended.' };
    case 'trial_expired':
      return {
        severity: 'urgent',
        message: 'Trial expired.',
      };
    case 'trial': {
      if (!input.trialEndsAt) return null;
      const days = wholeDays(now, input.trialEndsAt);
      if (days <= 3) {
        return {
          severity: 'warning',
          message:
            days <= 0
              ? 'Trial ends today.'
              : `Trial ends in ${days} ${days === 1 ? 'day' : 'days'}.`,
        };
      }
      break;
    }
    case 'subscribed':
      if (input.cancelAtPeriodEnd && input.periodEnd) {
        return { severity: 'warning', message: `Cancels on ${shortDate(input.periodEnd)}.` };
      }
      break;
    default:
      break;
  }
  if (input.overLimit.length > 0 && input.state !== 'suspended') {
    return { severity: 'warning', message: `Over limit: ${input.overLimit.join(', ')}.` };
  }
  return null;
}
