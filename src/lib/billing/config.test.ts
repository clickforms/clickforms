import { describe, expect, it } from 'vitest';
import {
  annualTotalCents,
  isPaidPlan,
  monthlyCents,
  parsePriceLookupKey,
  priceLookupKey,
} from '@/lib/billing/config';

describe('billing config', () => {
  it('builds and parses price lookup keys', () => {
    expect(priceLookupKey('business', 'month')).toBe('business_monthly');
    expect(priceLookupKey('professional', 'year')).toBe('professional_annual');
    expect(parsePriceLookupKey('standard_annual')).toEqual({ plan: 'standard', interval: 'year' });
    expect(parsePriceLookupKey('standard_monthly')).toEqual({
      plan: 'standard',
      interval: 'month',
    });
  });

  it('rejects anything that is not one of our prices', () => {
    expect(parsePriceLookupKey(null)).toBeNull();
    expect(parsePriceLookupKey('enterprise_monthly')).toBeNull();
    expect(parsePriceLookupKey('standard_weekly')).toBeNull();
    expect(parsePriceLookupKey('nonsense')).toBeNull();
  });

  it('only treats standard, business and professional as paid plans', () => {
    expect(isPaidPlan('standard')).toBe(true);
    expect(isPaidPlan('enterprise')).toBe(false);
  });

  it('computes GST-inclusive prices with the 10% annual discount', () => {
    expect(monthlyCents(86)).toBe(8600);
    expect(annualTotalCents(72)).toBe(86_400);
    expect(annualTotalCents(109)).toBe(130_800);
    expect(annualTotalCents(185)).toBe(222_000);
  });
});
