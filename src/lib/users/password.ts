import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

export const PASSWORD_MIN_LENGTH = 8;

export const PASSWORD_HINT =
  'At least 8 characters, with one uppercase letter, one number, and one special character';

export const PASSWORD_REQUIREMENTS_MESSAGE =
  'Password must be at least 8 characters and include an uppercase letter, a number, and a special character.';

export function isStrongPassword(password: string): boolean {
  return (
    password.length >= PASSWORD_MIN_LENGTH &&
    /[A-Z]/.test(password) &&
    /\d/.test(password) &&
    /[^A-Za-z0-9]/.test(password)
  );
}

/** Shared by every "set a password" API (signup verify, invite accept, reset, change). */
export const passwordSchema = z.string().refine(isStrongPassword, {
  message: PASSWORD_REQUIREMENTS_MESSAGE,
});

/**
 * Password hashing. New hashes use scrypt via Node's built-in crypto, which runs on libuv's
 * thread pool — off the main thread. The previous bcryptjs (pure JS) hashed/compared on the
 * main thread, so every sign-in burned the single event loop for ~100-300ms and stalled every
 * other in-flight request on the box (reported as "lag around login/at busy times").
 *
 * Parameters: N=2^16 (64 MiB, the memory-hardness that matters against GPU/ASIC cracking —
 * double OWASP's N=2^15 option), r=8, p=1: ~120ms per hash on the thread pool.
 * Existing bcrypt hashes keep verifying (bcryptjs is now only used for that), and are
 * transparently replaced with a scrypt hash the next time their owner signs in — see
 * needsRehash and src/lib/auth.ts's authorize().
 *
 * Stored format: scrypt$<N>$<r>$<p>$<salt b64>$<hash b64>
 */
const SCRYPT_N = 2 ** 16;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_KEYLEN = 32;
const SCRYPT_MAXMEM = 128 * SCRYPT_N * SCRYPT_R * 2;

function scryptAsync(
  password: string,
  salt: Buffer,
  params: { N: number; r: number; p: number },
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      password.normalize('NFKC'),
      salt,
      SCRYPT_KEYLEN,
      { ...params, maxmem: SCRYPT_MAXMEM },
      (error, derived) => (error ? reject(error) : resolve(derived)),
    );
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = await scryptAsync(password, salt, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P });
  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt.toString('base64')}$${derived.toString('base64')}`;
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  if (!hash.startsWith('scrypt$')) {
    // Legacy bcrypt hash (pre-scrypt accounts).
    return bcrypt.compare(password, hash);
  }
  const [, n, r, p, saltB64, hashB64] = hash.split('$');
  if (!n || !r || !p || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, 'base64');
  try {
    const derived = await scryptAsync(password, Buffer.from(saltB64, 'base64'), {
      N: Number(n),
      r: Number(r),
      p: Number(p),
    });
    return derived.length === expected.length && timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

/**
 * True for any hash that isn't current-format scrypt (i.e. every legacy bcrypt hash). Used to
 * opportunistically rehash right after the plaintext has been verified at sign-in, so users
 * move to scrypt without a forced reset. The verified plaintext is required to produce the
 * replacement, so this can only ever be triggered by the account owner successfully signing in.
 */
export function needsRehash(hash: string): boolean {
  const [scheme, n, r, p] = hash.split('$');
  return !(
    scheme === 'scrypt' &&
    Number(n) === SCRYPT_N &&
    Number(r) === SCRYPT_R &&
    Number(p) === SCRYPT_P
  );
}
