import { describe, expect, it } from 'vitest';
import { formatIsoDateForDisplay, parseIsoDate, toIsoDate } from '@/lib/forms/date-value';

describe('date-value', () => {
  it('round-trips ISO dates', () => {
    const date = new Date(2026, 6, 12);
    expect(toIsoDate(date)).toBe('2026-07-12');
    expect(parseIsoDate('2026-07-12')).toEqual(date);
  });

  it('formats dates for display', () => {
    expect(formatIsoDateForDisplay('2026-07-12')).toBe('12/07/2026');
  });
});
