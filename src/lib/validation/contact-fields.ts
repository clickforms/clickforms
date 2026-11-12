// Field checks shared by the signup form (instant, inline messages) and the signup API
// (the real enforcement), so both always agree. Each returns an error message, or null when
// the value is fine.

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// Typed-by-mistake endings that look valid to a pattern check but never deliver.
const TLD_TYPOS: Record<string, string> = {
  vom: 'com',
  con: 'com',
  cim: 'com',
  cmo: 'com',
  coom: 'com',
  comm: 'com',
  ocm: 'com',
  xom: 'com',
  om: 'com',
  nte: 'net',
  ent: 'net',
  ogr: 'org',
  rog: 'org',
  'com.a': 'com.au',
  'com.ua': 'com.au',
  'co.au': 'com.au',
  'org.a': 'org.au',
  'net.a': 'net.au',
};

const DOMAIN_TYPOS: Record<string, string> = {
  'gmial.com': 'gmail.com',
  'gmal.com': 'gmail.com',
  'gamil.com': 'gmail.com',
  'gnail.com': 'gmail.com',
  'gmail.co': 'gmail.com',
  'hotmial.com': 'hotmail.com',
  'hotmal.com': 'hotmail.com',
  'hotmail.co': 'hotmail.com',
  'yaho.com': 'yahoo.com',
  'yahooo.com': 'yahoo.com',
  'yahoo.co': 'yahoo.com',
  'outlok.com': 'outlook.com',
  'outloook.com': 'outlook.com',
  'iclod.com': 'icloud.com',
  'icloud.co': 'icloud.com',
};

export function validateEmailField(raw: string): string | null {
  const email = raw.trim().toLowerCase();
  if (!email) return 'Enter your email address.';
  if (email.length > 254 || !EMAIL_PATTERN.test(email)) {
    return 'Enter a valid email address, like name@organisation.com.au.';
  }
  const domain = email.split('@')[1] ?? '';
  if (domain.startsWith('.') || domain.endsWith('.') || domain.includes('..')) {
    return 'Enter a valid email address, like name@organisation.com.au.';
  }
  const fixedDomain = DOMAIN_TYPOS[domain];
  if (fixedDomain) {
    return `Did you mean ${email.split('@')[0]}@${fixedDomain}?`;
  }
  for (const [typo, fix] of Object.entries(TLD_TYPOS)) {
    if (domain.endsWith(`.${typo}`)) {
      const corrected = `${email.split('@')[0]}@${domain.slice(0, -typo.length)}${fix}`;
      return `That ending doesn't look right. Did you mean ${corrected}?`;
    }
  }
  return null;
}

export function validatePhoneField(raw: string): string | null {
  const phone = raw.trim();
  if (!phone) return 'Enter a phone number.';
  if (!/^[+()\d\s-]+$/.test(phone)) {
    return 'Use digits only, for example 0412 345 678 or +61 412 345 678.';
  }
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 8 || digits.length > 15) {
    return 'Enter a valid phone number, for example 0412 345 678 or +61 412 345 678.';
  }
  // Australian numbers written with a leading 0 are 10 digits (mobile and area-coded landline).
  if (phone.startsWith('0') && digits.length !== 10) {
    return 'Australian numbers have 10 digits, for example 0412 345 678.';
  }
  return null;
}

export function validateNameField(raw: string, label: string): string | null {
  const name = raw.trim();
  if (!name) return `Enter your ${label.toLowerCase()}.`;
  if (name.length > 100) return `${label} is too long.`;
  if (!/\p{L}/u.test(name)) return `${label} should contain letters.`;
  return null;
}

export function validateOrganisationNameField(raw: string): string | null {
  const name = raw.trim();
  if (!name) return 'Enter your organisation name.';
  if (name.length < 2) return 'Organisation name is too short.';
  if (name.length > 200) return 'Organisation name is too long.';
  if (!/[\p{L}\p{N}]/u.test(name)) return 'Organisation name should contain letters or numbers.';
  return null;
}
