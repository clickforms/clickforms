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
 * bcrypt cost factor for new password hashes. Every "set a password" route used to call
 * `bcrypt.hash(password, 12)` directly. That's a reasonable cost for the native C++
 * bcrypt binding, but this app uses bcryptjs (the pure-JS implementation — deliberately,
 * so the app doesn't need native module compilation in serverless deploys), which is
 * meaningfully slower per unit of cost. At cost 12 it commonly took several hundred ms per
 * hash/compare on a serverless function, and since NextAuth's authorize() runs one compare
 * on every single sign-in (see src/lib/auth.ts), that was showing up as customer reports
 * of "login is laggy." Cost 10 is still at OWASP's current minimum recommendation for
 * bcrypt ("work factor of 10 or more" — see the Password Storage Cheat Sheet) and cuts
 * that time to roughly a quarter, since bcrypt's cost is exponential: each +1 doubles the
 * work. This is a speed fix, not a security relaxation — 10 remains an accepted secure
 * value, and existing accounts are transparently upgraded to it (see needsRehash below)
 * rather than left on whatever cost they were created with.
 */
const BCRYPT_COST = 10;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_COST);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/** bcrypt hashes embed their own cost factor as the second '$'-delimited segment, e.g.
 * "$2a$12$...". Returns null for a malformed/non-bcrypt hash rather than throwing — callers
 * treat that the same as "needs rehashing," never as "somehow already fine." */
function bcryptCostOf(hash: string): number | null {
  const match = hash.match(/^\$2[aby]\$(\d{2})\$/);
  const digits = match?.[1];
  return digits ? Number.parseInt(digits, 10) : null;
}

/**
 * True when `hash` was made at a cost above the current target — i.e. it's one of the
 * pre-existing cost-12 hashes from before this fix shipped. Used to opportunistically
 * rehash a password at the new, faster cost right after it's next verified (see
 * src/lib/auth.ts's authorize()), so returning users get the speedup without a forced
 * password reset. Never fires for a hash already at or below BCRYPT_COST — this only ever
 * moves existing accounts *down* to the new standard cost, never below it, and the
 * verified plaintext password is required to produce the replacement hash, so this can't
 * be triggered by anything other than the account's own owner successfully signing in.
 */
export function needsRehash(hash: string): boolean {
  const cost = bcryptCostOf(hash);
  return cost === null || cost > BCRYPT_COST;
}
