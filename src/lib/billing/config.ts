import type { BillingInterval, OrgPlan } from '@prisma/client';

// Client-safe billing constants (no server-only imports): shared by the pricing page, the
// Organisation billing UI and the server-side Stripe code. See specs/08-billing.md.

/** Plans that are bought through Stripe. Enterprise is invoiced by hand (custom price). */
export type PaidPlan = Exclude<OrgPlan, 'enterprise'>;

export const PAID_PLANS: readonly PaidPlan[] = ['standard', 'business', 'professional'];

/** Annual billing is this much cheaper than twelve monthly payments. */
export const ANNUAL_DISCOUNT_PERCENT = 10;

export function isPaidPlan(plan: string): plan is PaidPlan {
  return (PAID_PLANS as readonly string[]).includes(plan);
}

/** Stripe Price lookup key, e.g. `business_annual`. Prices are created by
 * scripts/stripe-setup-prices.ts and always resolved by lookup key, never by price id. */
export function priceLookupKey(plan: PaidPlan, interval: BillingInterval): string {
  return `${plan}_${interval === 'year' ? 'annual' : 'monthly'}`;
}

/** Inverse of priceLookupKey. Returns null for anything that isn't one of our prices. */
export function parsePriceLookupKey(
  key: string | null | undefined,
): { plan: PaidPlan; interval: BillingInterval } | null {
  if (!key) return null;
  const [plan, suffix] = key.split('_');
  if (!plan || !isPaidPlan(plan)) return null;
  if (suffix === 'monthly') return { plan, interval: 'month' };
  if (suffix === 'annual') return { plan, interval: 'year' };
  return null;
}

/** Annual total in cents for a plan whose monthly price (GST-inclusive dollars) is given:
 * twelve months less ANNUAL_DISCOUNT_PERCENT, e.g. $82 -> 88_560 ($885.60). */
export function annualTotalCents(monthlyDollars: number): number {
  return Math.round(monthlyDollars * 12 * (100 - ANNUAL_DISCOUNT_PERCENT));
}

/** Monthly price in cents. Dollars are whole numbers in PLAN_PRICING. */
export function monthlyCents(monthlyDollars: number): number {
  return Math.round(monthlyDollars * 100);
}
