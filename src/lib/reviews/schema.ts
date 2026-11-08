import { z } from 'zod';

// Client-safe: shared by the public form (for limits and messages) and the API route.

export const REVIEW_BODY_MAX = 2000;
export const REVIEW_BODY_MIN = 10;

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Please keep this under ${max} characters.`)
    .optional()
    .transform((value) => (value ? value : undefined));

export const reviewInputSchema = z.object({
  name: z.string().trim().min(1, 'Please enter your full name.').max(120),
  company: z.string().trim().min(1, 'Please enter your company or organisation.').max(160),
  body: z
    .string()
    .trim()
    .min(REVIEW_BODY_MIN, `Please write at least ${REVIEW_BODY_MIN} characters.`)
    .max(REVIEW_BODY_MAX, `Please keep your review under ${REVIEW_BODY_MAX} characters.`),
  role: optionalText(120),
  rating: z
    .number()
    .int()
    .min(1)
    .max(5)
    .nullable()
    .optional()
    .transform((value) => value ?? undefined),
  email: z
    .string()
    .trim()
    .max(254)
    .optional()
    .transform((value) => (value ? value : undefined))
    .refine((value) => value === undefined || z.string().email().safeParse(value).success, {
      message: 'Please enter a valid email address.',
    }),
  consent: z.literal(true, {
    error: 'Please tick the box so we know we can publish your review.',
  }),
  // Honeypot: real people never see or fill this field.
  website: z.string().max(0).optional(),
});

export type ReviewInput = z.infer<typeof reviewInputSchema>;

export const reviewStatusSchema = z.enum(['pending', 'approved', 'hidden']);
