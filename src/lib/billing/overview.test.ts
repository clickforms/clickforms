import { describe, expect, it } from 'vitest';
import {
  attentionFor,
  billingStateFor,
  describeBillingAction,
  monthlyRevenueCents,
} from '@/lib/billing/overview';

const now = new Date('2026-11-07T00:00:00Z');
const base = {
  status: 'active' as const,
  trialEndsAt: null,
  billingMode: 'stripe' as const,
  stripeStatus: 'active' as string | null,
};

describe('billingStateFor', () => {
  it('maps Stripe statuses', () => {
    expect(billingStateFor(base, now)).toBe('subscribed');
    expect(billingStateFor({ ...base, stripeStatus: 'past_due' }, now)).toBe('past_due');
    expect(billingStateFor({ ...base, stripeStatus: 'canceled' }, now)).toBe('ended');
  });

  it('handles trials and manual billing', () => {
    const manual = { ...base, billingMode: 'manual' as const, stripeStatus: null };
    expect(billingStateFor(manual, now)).toBe('manual');
    expect(
      billingStateFor(
        { ...manual, status: 'trial', trialEndsAt: new Date('2026-11-10T00:00:00Z') },
        now,
      ),
    ).toBe('trial');
    expect(
      billingStateFor(
        { ...manual, status: 'trial', trialEndsAt: new Date('2026-11-01T00:00:00Z') },
        now,
      ),
    ).toBe('trial_expired');
  });

  it('suspended wins over everything', () => {
    expect(billingStateFor({ ...base, status: 'suspended', stripeStatus: 'past_due' }, now)).toBe(
      'suspended',
    );
  });
});

describe('monthlyRevenueCents', () => {
  it('uses the monthly price and the annual price per month', () => {
    expect(monthlyRevenueCents('standard', 'month', null, now)).toBe(8600);
    expect(monthlyRevenueCents('standard', 'year', null, now)).toBe(7200);
  });

  it('applies running percent and amount discounts, ignoring expired ones', () => {
    expect(
      monthlyRevenueCents(
        'standard',
        'month',
        { percentOff: 20, amountOff: null, endsAt: null },
        now,
      ),
    ).toBe(6880);
    expect(
      monthlyRevenueCents(
        'standard',
        'month',
        { percentOff: null, amountOff: 1000, endsAt: null },
        now,
      ),
    ).toBe(7600);
    expect(
      monthlyRevenueCents(
        'standard',
        'month',
        { percentOff: 20, amountOff: null, endsAt: '2026-11-01T00:00:00Z' },
        now,
      ),
    ).toBe(8600);
  });

  it('counts enterprise as zero and never goes negative', () => {
    expect(monthlyRevenueCents('enterprise', 'month', null, now)).toBe(0);
    expect(
      monthlyRevenueCents(
        'standard',
        'month',
        { percentOff: null, amountOff: 999999, endsAt: null },
        now,
      ),
    ).toBe(0);
  });
});

describe('describeBillingAction', () => {
  it('describes grants with their label and falls back for unknown actions', () => {
    expect(
      describeBillingAction('admin.billing.discount_grant', { label: '20% off for 2 months' }),
    ).toBe('Granted 20% off for 2 months');
    expect(describeBillingAction('admin.billing.discount_grant', {})).toBe('Granted a discount');
    expect(describeBillingAction('something.else', null)).toBe('something.else');
  });
});

describe('attentionFor', () => {
  const input = {
    state: 'subscribed' as const,
    trialEndsAt: null,
    pastDueSince: null,
    cancelAtPeriodEnd: false,
    periodEnd: null,
    overLimit: [] as string[],
  };

  it('is null when all is well', () => {
    expect(attentionFor(input, now)).toBeNull();
  });

  it('flags failing payments as urgent', () => {
    const result = attentionFor(
      { ...input, state: 'past_due', pastDueSince: new Date('2026-11-04T00:00:00Z') },
      now,
    );
    expect(result?.severity).toBe('urgent');
    expect(result?.message).toBe('Payment failing for 3 days.');
  });

  it('warns about trials ending within three days only', () => {
    const soon = attentionFor(
      { ...input, state: 'trial', trialEndsAt: new Date('2026-11-09T00:00:00Z') },
      now,
    );
    expect(soon?.message).toBe('Trial ends in 2 days.');
    expect(
      attentionFor(
        { ...input, state: 'trial', trialEndsAt: new Date('2026-11-20T00:00:00Z') },
        now,
      ),
    ).toBeNull();
  });

  it('reports over-limit usage when nothing more urgent applies', () => {
    expect(attentionFor({ ...input, overLimit: ['Forms', 'Users'] }, now)?.message).toBe(
      'Over limit: Forms, Users.',
    );
  });
});
