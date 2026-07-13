import { describe, expect, it } from 'vitest';
import {
  formatTimeForDisplay,
  isValidTimeValue,
  parseTimeValue,
  toTimeValue,
} from '@/lib/forms/time-value';

describe('time-value', () => {
  it('parses and serializes HH:mm', () => {
    expect(parseTimeValue('09:05')).toEqual({ hours: 9, minutes: 5 });
    expect(toTimeValue(9, 5)).toBe('09:05');
    expect(isValidTimeValue('23:59')).toBe(true);
    expect(isValidTimeValue('24:00')).toBe(false);
  });

  it('formats for display in 12-hour style', () => {
    expect(formatTimeForDisplay('00:00')).toBe('12:00 am');
    expect(formatTimeForDisplay('09:05')).toBe('9:05 am');
    expect(formatTimeForDisplay('12:30')).toBe('12:30 pm');
    expect(formatTimeForDisplay('14:15')).toBe('2:15 pm');
    expect(formatTimeForDisplay('')).toBe('');
  });
});
