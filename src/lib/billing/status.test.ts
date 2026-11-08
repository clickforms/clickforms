import { describe, expect, it } from 'vitest';
import { accessForStripeStatus, getBillingAccess, graceDaysRemaining } from '@/lib/billing/status';

const now = new Date('2026-11-07T00:00:00Z');
const past = new Date('2026-11-01T00:00:00Z');
const future = new Date('2026-11-20T00:00:00Z');

describe('accessForStripeStatus', () => {
  it('gives full access to healthy subscriptions', () => {
    expect(accessForStripeStatus('active')).toBe('full');
    expect(accessForStripeStatus('trialing')).toBe('full');
  });

  it('keeps access during the payment-retry grace period', () => {
    expect(accessForStripeStatus('past_due')).toBe('grace');
    expect(accessForStripeStatus('incomplete')).toBe('grace');
  });

  it('goes read-only once retries are exhausted or the subscription ends', () => {
    expect(accessForStripeStatus('unpaid')).toBe('read_only');
    expect(accessForStripeStatus('canceled')).toBe('read_only');
    expect(accessForStripeStatus('incomplete_expired')).toBe('read_only');
    expect(accessForStripeStatus('paused')).toBe('read_only');
  });

  it('fails closed on a status it does not know', () => {
    expect(accessForStripeStatus('something_new')).toBe('read_only');
  });
});

describe('getBillingAccess', () => {
  it('leaves manual-billing orgs on the original trial behaviour', () => {
    expect(
      getBillingAccess({ billingMode: 'manual', status: 'active', trialEndsAt: null }, null, now),
    ).toBe('full');
    expect(
      getBillingAccess({ billingMode: 'manual', status: 'trial', trialEndsAt: future }, null, now),
    ).toBe('full');
    expect(
      getBillingAccess({ billingMode: 'manual', status: 'trial', trialEndsAt: past }, null, now),
    ).toBe('read_only');
  });

  it('ignores a stale subscription row on a manual-billing org', () => {
    expect(
      getBillingAccess(
        { billingMode: 'manual', status: 'active', trialEndsAt: null },
        { stripeStatus: 'canceled' },
        now,
      ),
    ).toBe('full');
  });

  it('keeps a Stripe-billed org on its trial until it has a subscription', () => {
    expect(
      getBillingAccess({ billingMode: 'stripe', status: 'trial', trialEndsAt: future }, null, now),
    ).toBe('full');
    expect(
      getBillingAccess({ billingMode: 'stripe', status: 'trial', trialEndsAt: past }, null, now),
    ).toBe('read_only');
  });

  it('follows the subscription once one exists', () => {
    const org = { billingMode: 'stripe', status: 'active', trialEndsAt: null } as const;
    expect(getBillingAccess(org, { stripeStatus: 'active' }, now)).toBe('full');
    expect(getBillingAccess(org, { stripeStatus: 'past_due' }, now)).toBe('grace');
    expect(getBillingAccess(org, { stripeStatus: 'unpaid' }, now)).toBe('read_only');
  });
});

describe('graceDaysRemaining', () => {
  it('counts down from a 14 day grace period and never goes negative', () => {
    expect(graceDaysRemaining(null, 14, now)).toBeNull();
    expect(graceDaysRemaining(new Date('2026-11-04T00:00:00Z'), 14, now)).toBe(11);
    expect(graceDaysRemaining(new Date('2026-10-01T00:00:00Z'), 14, now)).toBe(0);
  });
});

describe('getBillingAccess on the Free plan', () => {
  const now = new Date('2026-06-01T00:00:00Z');
  it('keeps full access after a subscription ends into Free', () => {
    const org = {
      billingMode: 'stripe',
      plan: 'free',
      status: 'active',
      trialEndsAt: null,
    } as const;
    expect(getBillingAccess(org, { stripeStatus: 'canceled' }, now)).toBe('full');
  });
  it('still treats a lapsed paid subscription as read-only', () => {
    const org = {
      billingMode: 'stripe',
      plan: 'standard',
      status: 'active',
      trialEndsAt: null,
    } as const;
    expect(getBillingAccess(org, { stripeStatus: 'canceled' }, now)).toBe('read_only');
  });
});
