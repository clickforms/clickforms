import { describe, expect, it } from 'vitest';
import { reviewInputSchema } from '@/lib/reviews/schema';
import { fillMonths, groupReviews, summarizeRatings } from '@/lib/reviews/stats';

describe('summarizeRatings', () => {
  it('averages only rated reviews and counts each star', () => {
    const summary = summarizeRatings([5, 4, null, 5, 1]);
    expect(summary.rated).toBe(4);
    expect(summary.average).toBe(3.8);
    expect(summary.distribution).toEqual([1, 0, 0, 1, 2]);
  });

  it('has no average when nothing is rated', () => {
    expect(summarizeRatings([null, null]).average).toBeNull();
    expect(summarizeRatings([]).rated).toBe(0);
  });
});

describe('groupReviews', () => {
  const rows = [
    { company: 'Care Circle', role: 'Manager', rating: 5, status: 'approved' as const },
    { company: ' care circle ', role: 'manager', rating: 4, status: 'pending' as const },
    { company: 'Harmony Home', role: null, rating: null, status: 'approved' as const },
  ];

  it('groups case-insensitively and averages stars', () => {
    const companies = groupReviews(rows, 'company');
    expect(companies[0]).toEqual({ label: 'Care Circle', count: 2, rated: 2, average: 4.5 });
    expect(companies[1]?.label).toBe('Harmony Home');
  });

  it('labels missing roles', () => {
    const roles = groupReviews(rows, 'role');
    expect(roles.find((group) => group.label === 'Not given')?.count).toBe(1);
  });
});

describe('fillMonths', () => {
  it('returns consecutive months with zeros filled in', () => {
    const points = fillMonths(new Map([['2026-11', 7]]), new Date('2026-11-08T00:00:00Z'), 3);
    expect(points.map((point) => point.month)).toEqual(['2026-09', '2026-10', '2026-11']);
    expect(points.map((point) => point.count)).toEqual([0, 0, 7]);
  });
});

describe('reviewInputSchema', () => {
  const valid = {
    name: 'Sarah Mitchell',
    company: 'Bright Path Support Services',
    body: 'We moved intake off paper and it saves hours every week.',
    consent: true as const,
  };

  it('accepts a minimal review and trims optional fields', () => {
    const parsed = reviewInputSchema.parse({ ...valid, role: '  ', email: '' });
    expect(parsed.role).toBeUndefined();
    expect(parsed.email).toBeUndefined();
  });

  it('requires consent and a valid rating', () => {
    expect(reviewInputSchema.safeParse({ ...valid, consent: false }).success).toBe(false);
    expect(reviewInputSchema.safeParse({ ...valid, rating: 6 }).success).toBe(false);
    expect(reviewInputSchema.safeParse({ ...valid, rating: 5 }).success).toBe(true);
  });

  it('rejects a filled honeypot and short reviews', () => {
    expect(reviewInputSchema.safeParse({ ...valid, website: 'spam.example' }).success).toBe(false);
    expect(reviewInputSchema.safeParse({ ...valid, body: 'Great' }).success).toBe(false);
  });
});
