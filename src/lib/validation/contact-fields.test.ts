import { describe, expect, it } from 'vitest';
import {
  validateEmailField,
  validateNameField,
  validateOrganisationNameField,
  validatePhoneField,
} from '@/lib/validation/contact-fields';

describe('validateEmailField', () => {
  it('accepts ordinary addresses', () => {
    expect(validateEmailField('moses.buta@yahoo.com.au')).toBe(null);
    expect(validateEmailField('a@gmail.com')).toBe(null);
  });
  it('catches mistyped endings and domains', () => {
    expect(validateEmailField('ethmoses@gmail.vom')?.includes('ethmoses@gmail.com')).toBe(true);
    expect(validateEmailField('x@gmial.com')?.includes('gmail.com')).toBe(true);
  });
  it('rejects malformed addresses', () => {
    expect(validateEmailField('bad') === null).toBe(false);
    expect(validateEmailField('') === null).toBe(false);
  });
});

describe('validatePhoneField', () => {
  it('accepts Australian and international numbers', () => {
    expect(validatePhoneField('0401915591')).toBe(null);
    expect(validatePhoneField('+61 412 345 678')).toBe(null);
  });
  it('rejects short, long and non-numeric input', () => {
    expect(validatePhoneField('0412 345') === null).toBe(false);
    expect(validatePhoneField('abc') === null).toBe(false);
    expect(validatePhoneField('04019155910') === null).toBe(false);
  });
});

describe('name fields', () => {
  it('requires letters', () => {
    expect(validateNameField('moses', 'First name')).toBe(null);
    expect(validateNameField('123', 'First name') === null).toBe(false);
    expect(validateOrganisationNameField('Good Havan')).toBe(null);
    expect(validateOrganisationNameField('A') === null).toBe(false);
  });
});
