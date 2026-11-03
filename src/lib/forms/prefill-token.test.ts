import { beforeAll, describe, expect, it } from 'vitest';
import { createPrefillToken, readPrefillToken } from '@/lib/forms/prefill-token';

describe('prefill token', () => {
  beforeAll(() => {
    process.env.SESSION_SECRET = 'test-secret';
  });

  it('round-trips answers for the same form', () => {
    const token = createPrefillToken('form-1', { a: 'x', b: ['y', 'z'] });
    expect(readPrefillToken(token, 'form-1')).toEqual({ a: 'x', b: ['y', 'z'] });
  });

  it('rejects another form, tampering, and garbage', () => {
    const token = createPrefillToken('form-1', { a: 'x' });
    expect(readPrefillToken(token, 'form-2')).toBeNull();
    expect(readPrefillToken(`${token.slice(0, -2)}AA`, 'form-1')).toBeNull();
    expect(readPrefillToken('nope', 'form-1')).toBeNull();
  });

  it('does not expose answers in the token text', () => {
    expect(createPrefillToken('form-1', { a: 'Jane Citizen' })).not.toContain('Jane');
  });
});
