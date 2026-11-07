import { describe, expect, it } from 'vitest';
import {
  couponParams,
  describeGrant,
  endOfDayUnix,
  grantInputSchema,
  grantShape,
  promotionCodeInputSchema,
} from '@/lib/billing/grants';

describe('grantInputSchema', () => {
  it('accepts "20% off for 2 months"', () => {
    const input = grantInputSchema.parse({
      kind: 'percent',
      percentOff: 20,
      duration: 'repeating',
      durationMonths: 2,
      reason: 'Early customer',
    });
    expect(describeGrant(grantShape(input))).toBe('20% off for 2 months');
  });

  it('requires a month count for repeating discounts', () => {
    const result = grantInputSchema.safeParse({
      kind: 'percent',
      percentOff: 20,
      duration: 'repeating',
      reason: 'Early customer',
    });
    expect(result.success).toBe(false);
  });

  it('rejects out-of-range values and missing reasons', () => {
    expect(
      grantInputSchema.safeParse({
        kind: 'percent',
        percentOff: 0,
        duration: 'once',
        reason: 'ok!',
      }).success,
    ).toBe(false);
    expect(
      grantInputSchema.safeParse({
        kind: 'percent',
        percentOff: 101,
        duration: 'once',
        reason: 'ok!',
      }).success,
    ).toBe(false);
    expect(
      grantInputSchema.safeParse({ kind: 'credit', amountCents: 5000, reason: ' ' }).success,
    ).toBe(false);
    expect(
      grantInputSchema.safeParse({ kind: 'credit', amountCents: 50, reason: 'too small' }).success,
    ).toBe(false);
  });
});

describe('couponParams', () => {
  it('builds a repeating percent coupon', () => {
    const shape = grantShape(
      grantInputSchema.parse({
        kind: 'percent',
        percentOff: 20,
        duration: 'repeating',
        durationMonths: 2,
        reason: 'Early customer',
      }),
    );
    expect(couponParams(shape)).toEqual({
      percent_off: 20,
      duration: 'repeating',
      duration_in_months: 2,
    });
  });

  it('builds free months as a 100% repeating coupon', () => {
    const shape = grantShape(
      grantInputSchema.parse({ kind: 'free_months', months: 3, reason: 'Apology' }),
    );
    expect(couponParams(shape)).toEqual({
      percent_off: 100,
      duration: 'repeating',
      duration_in_months: 3,
    });
    expect(describeGrant(shape)).toBe('3 free months');
  });

  it('builds a fixed-amount coupon in AUD and ignores months for non-repeating durations', () => {
    const shape = grantShape(
      grantInputSchema.parse({
        kind: 'amount',
        amountCents: 5000,
        duration: 'once',
        durationMonths: 4,
        reason: 'Goodwill',
      }),
    );
    expect(couponParams(shape)).toEqual({ amount_off: 5000, currency: 'aud', duration: 'once' });
    expect(describeGrant(shape)).toBe('$50.00 off on the next invoice');
  });

  it('uses no coupon for credit', () => {
    const shape = grantShape(
      grantInputSchema.parse({ kind: 'credit', amountCents: 10000, reason: 'Outage' }),
    );
    expect(couponParams(shape)).toBeNull();
    expect(describeGrant(shape)).toBe('$100.00 account credit');
  });
});

describe('promotionCodeInputSchema', () => {
  const base = {
    code: 'welcome20',
    name: 'Launch offer',
    duration: 'once' as const,
  };

  it('uppercases and validates the code', () => {
    const parsed = promotionCodeInputSchema.parse({ ...base, percentOff: 20 });
    expect(parsed.code).toBe('WELCOME20');
    expect(
      promotionCodeInputSchema.safeParse({ ...base, code: 'a b', percentOff: 20 }).success,
    ).toBe(false);
  });

  it('needs exactly one of percent or amount', () => {
    expect(promotionCodeInputSchema.safeParse(base).success).toBe(false);
    expect(
      promotionCodeInputSchema.safeParse({ ...base, percentOff: 20, amountCents: 1000 }).success,
    ).toBe(false);
  });
});

describe('endOfDayUnix', () => {
  it('is the last second of the UTC day', () => {
    expect(endOfDayUnix('2026-12-31')).toBe(Date.UTC(2026, 11, 31, 23, 59, 59) / 1000);
  });
});
