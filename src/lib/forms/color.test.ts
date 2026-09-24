import { describe, expect, it } from 'vitest';
import { normalizeHexColor } from '@/lib/forms/color';

describe('normalizeHexColor', () => {
  it('accepts a 6-digit hex with a leading #', () => {
    expect(normalizeHexColor('#9B1B1B')).toBe('#9b1b1b');
  });

  it('accepts a 6-digit hex pasted without a leading # (e.g. copied from Figma)', () => {
    expect(normalizeHexColor('9b1b1b')).toBe('#9b1b1b');
  });

  it('accepts a 3-digit hex with or without a leading #', () => {
    expect(normalizeHexColor('#9bf')).toBe('#99bbff');
    expect(normalizeHexColor('9bf')).toBe('#99bbff');
  });

  it('accepts rgb() strings', () => {
    expect(normalizeHexColor('rgb(155, 27, 27)')).toBe('#9b1b1b');
  });

  it('trims surrounding whitespace', () => {
    expect(normalizeHexColor('  9b1b1b  ')).toBe('#9b1b1b');
  });

  it('rejects invalid input', () => {
    expect(normalizeHexColor('not-a-color')).toBeNull();
    expect(normalizeHexColor('')).toBeNull();
    expect(normalizeHexColor('12345')).toBeNull();
  });
});
