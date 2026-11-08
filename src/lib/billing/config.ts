import type { BillingInterval, OrgPlan } from '@prisma/client';

// Client-safe billing constants (no server-only imports): shared by the pricing page, the
// Organisation billing UI and the server-side Stripe code. See specs/08-billing.md.

/** Plans that are bought through Stripe. Free costs nothing and Enterprise is invoiced by
 * hand (custom price). */
export type PaidPlan = Exclude<OrgPlan, 'free' | 'enterprise'>;

export const PAID_PLANS: readonly PaidPlan[] = ['standard', 'business', 'professional'];

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

/** Annual total in cents for a plan whose effective per-month price when billed yearly
 * (PLAN_PRICING[plan].annual, GST-inclusive dollars) is given, e.g. $72 -> 86_400 ($864). */
export function annualTotalCents(annualPerMonthDollars: number): number {
  return Math.round(annualPerMonthDollars * 12 * 100);
}

/** Monthly price in cents. Dollars are whole numbers in PLAN_PRICING. */
export function monthlyCents(monthlyDollars: number): number {
  return Math.round(monthlyDollars * 100);
}
