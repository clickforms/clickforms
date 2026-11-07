import { z } from 'zod';

// Pure rules for admin-granted discounts and credit (no Stripe, no DB), so they can be unit
// tested. The Stripe calls live in admin.ts.

const reason = z.string().trim().min(3, 'Please give a reason.').max(300);
const duration = z.enum(['once', 'repeating', 'forever']);
const durationMonths = z.number().int().min(1).max(36);

export const MAX_DISCOUNT_CENTS = 1_000_000; // $10,000

export const grantInputSchema = z
  .discriminatedUnion('kind', [
    z.object({
      kind: z.literal('percent'),
      percentOff: z.number().int().min(1).max(100),
      duration,
      durationMonths: durationMonths.optional(),
      reason,
    }),
    z.object({
      kind: z.literal('amount'),
      amountCents: z.number().int().min(100).max(MAX_DISCOUNT_CENTS),
      duration,
      durationMonths: durationMonths.optional(),
      reason,
    }),
    z.object({
      kind: z.literal('free_months'),
      months: z.number().int().min(1).max(24),
      reason,
    }),
    z.object({
      kind: z.literal('credit'),
      amountCents: z.number().int().min(100).max(MAX_DISCOUNT_CENTS),
      reason,
    }),
  ])
  .superRefine((value, ctx) => {
    if (
      (value.kind === 'percent' || value.kind === 'amount') &&
      value.duration === 'repeating' &&
      !value.durationMonths
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['durationMonths'],
        message: 'Choose how many months the discount lasts.',
      });
    }
  });

export type GrantInput = z.infer<typeof grantInputSchema>;

/** What a grant is stored as: the columns of billing_discount_grants that depend on the input. */
export interface GrantShape {
  kind: GrantInput['kind'];
  value: number;
  duration: 'once' | 'repeating' | 'forever' | null;
  durationMonths: number | null;
}

export function grantShape(input: GrantInput): GrantShape {
  switch (input.kind) {
    case 'percent':
      return {
        kind: 'percent',
        value: input.percentOff,
        duration: input.duration,
        durationMonths: input.duration === 'repeating' ? (input.durationMonths ?? null) : null,
      };
    case 'amount':
      return {
        kind: 'amount',
        value: input.amountCents,
        duration: input.duration,
        durationMonths: input.duration === 'repeating' ? (input.durationMonths ?? null) : null,
      };
    case 'free_months':
      return {
        kind: 'free_months',
        value: input.months,
        duration: 'repeating',
        durationMonths: input.months,
      };
    case 'credit':
      return { kind: 'credit', value: input.amountCents, duration: null, durationMonths: null };
  }
}

/** Parameters for stripe.coupons.create, or null for kinds that don't use a coupon (credit). */
export function couponParams(shape: GrantShape): {
  percent_off?: number;
  amount_off?: number;
  currency?: string;
  duration: 'once' | 'repeating' | 'forever';
  duration_in_months?: number;
} | null {
  if (shape.kind === 'credit' || !shape.duration) return null;
  const base = {
    duration: shape.duration,
    ...(shape.duration === 'repeating' && shape.durationMonths
      ? { duration_in_months: shape.durationMonths }
      : {}),
  };
  switch (shape.kind) {
    case 'percent':
      return { percent_off: shape.value, ...base };
    case 'free_months':
      return { percent_off: 100, ...base };
    case 'amount':
      return { amount_off: shape.value, currency: 'aud', ...base };
  }
}

function months(count: number): string {
  return `${count} ${count === 1 ? 'month' : 'months'}`;
}

/** Human label, e.g. "20% off for 2 months", "$50.00 off once", "1 free month". */
export function describeGrant(shape: GrantShape): string {
  const dollars = (cents: number) => `$${(cents / 100).toFixed(2)}`;
  const length = (): string => {
    if (shape.duration === 'once') return ' on the next invoice';
    if (shape.duration === 'forever') return ' forever';
    return shape.durationMonths ? ` for ${months(shape.durationMonths)}` : '';
  };
  switch (shape.kind) {
    case 'percent':
      return `${shape.value}% off${length()}`;
    case 'amount':
      return `${dollars(shape.value)} off${length()}`;
    case 'free_months':
      return `${shape.value} free ${shape.value === 1 ? 'month' : 'months'}`;
    case 'credit':
      return `${dollars(shape.value)} account credit`;
  }
}

export const promotionCodeInputSchema = z
  .object({
    code: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9_-]{4,32}$/, 'Use 4-32 letters, numbers, dashes or underscores.'),
    name: z.string().trim().min(2).max(80),
    percentOff: z.number().int().min(1).max(100).optional(),
    amountCents: z.number().int().min(100).max(MAX_DISCOUNT_CENTS).optional(),
    duration,
    durationMonths: durationMonths.optional(),
    maxRedemptions: z.number().int().min(1).max(100_000).optional(),
    /** ISO date (yyyy-mm-dd); the code expires at the end of that day (UTC). */
    expiresOn: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    firstTimeOnly: z.boolean().default(true),
  })
  .superRefine((value, ctx) => {
    if ((value.percentOff == null) === (value.amountCents == null)) {
      ctx.addIssue({
        code: 'custom',
        path: ['percentOff'],
        message: 'Set either a percentage or a dollar amount.',
      });
    }
    if (value.duration === 'repeating' && !value.durationMonths) {
      ctx.addIssue({
        code: 'custom',
        path: ['durationMonths'],
        message: 'Choose how many months the discount lasts.',
      });
    }
  });

export type PromotionCodeInput = z.infer<typeof promotionCodeInputSchema>;

/** End of the given UTC day as a unix timestamp (seconds). */
export function endOfDayUnix(isoDate: string): number {
  return Math.floor(new Date(`${isoDate}T23:59:59Z`).getTime() / 1000);
}
