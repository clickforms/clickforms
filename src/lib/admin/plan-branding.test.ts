import { describe, expect, it } from 'vitest';
import { PLAN_LIMITS, PLAN_PRICING, showsFormBranding } from '@/lib/admin/plan-limits';

describe('showsFormBranding', () => {
  it('shows the mark on Free and Standard only', () => {
    expect(showsFormBranding('free')).toBe(true);
    expect(showsFormBranding('standard')).toBe(true);
    expect(showsFormBranding('business')).toBe(false);
    expect(showsFormBranding('professional')).toBe(false);
    expect(showsFormBranding('enterprise')).toBe(false);
  });
});

describe('plan definitions', () => {
  it('matches the published Free, Standard and Business plans', () => {
    expect([PLAN_LIMITS.free.maxForms, PLAN_LIMITS.free.maxUsers]).toEqual([2, 1]);
    expect(PLAN_LIMITS.free.maxSubmissionsPerMonth).toBe(10);
    expect([PLAN_LIMITS.standard.maxForms, PLAN_LIMITS.standard.maxUsers]).toEqual([10, 3]);
    expect(PLAN_LIMITS.standard.maxSubmissionsPerMonth).toBe(500);
    expect([PLAN_LIMITS.business.maxForms, PLAN_LIMITS.business.maxUsers]).toEqual([50, 15]);
    expect(PLAN_LIMITS.business.maxSubmissionsPerMonth).toBe(5000);
    expect(PLAN_PRICING.free).toEqual({ monthly: 0, annual: 0 });
    expect(PLAN_PRICING.standard).toEqual({ monthly: 86, annual: 72 });
    expect(PLAN_PRICING.business).toEqual({ monthly: 130, annual: 109 });
  });
});
