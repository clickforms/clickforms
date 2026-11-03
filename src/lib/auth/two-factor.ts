import 'server-only';

import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/db';
import { sendEmail } from '@/lib/email';
import { twoFactorCodeEmail } from '@/lib/emails/templates';

// Email-code two-step verification. A 6-digit code is emailed, valid 10 minutes, max 5 wrong
// guesses, single use. Only an HMAC of the code is stored (a bare hash of a 6-digit number
// would be trivially reversible). Used for sign-in (purpose 'login') and to prove the user
// can receive the email before two-step is switched on ('enable').

export type TwoFactorPurpose = 'login' | 'enable';

const CODE_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_MS = 30 * 1000;

function hashCode(userId: string, purpose: TwoFactorPurpose, code: string): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error('SESSION_SECRET must be set for two-step verification');
  }
  return createHmac('sha256', secret).update(`${userId}:${purpose}:${code}`).digest('hex');
}

/** Emails a fresh code. Returns 'throttled' (and sends nothing) if one was sent in the last
 * 30 seconds, so the sign-in form's "resend" can't be used to spam an inbox. */
export async function issueTwoFactorCode(
  user: { id: string; email: string; name: string | null; organizationId: string | null },
  purpose: TwoFactorPurpose,
): Promise<'sent' | 'throttled'> {
  const recent = await prisma.$queryRaw<{ created_at: Date }[]>`
    SELECT created_at FROM two_factor_codes
    WHERE user_id = ${user.id}::uuid AND purpose = ${purpose}
    ORDER BY created_at DESC LIMIT 1`;
  const last = recent[0]?.created_at;
  if (last && Date.now() - last.getTime() < RESEND_COOLDOWN_MS) {
    console.log(`[2fa] ${purpose} code NOT sent to ${user.email} — resend cooldown (30s)`);
    return 'throttled';
  }

  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  const expiresAt = new Date(Date.now() + CODE_TTL_MS);

  await prisma.$executeRaw`
    DELETE FROM two_factor_codes WHERE user_id = ${user.id}::uuid AND purpose = ${purpose}`;
  await prisma.$executeRaw`
    INSERT INTO two_factor_codes (user_id, purpose, code_hash, expires_at)
    VALUES (${user.id}::uuid, ${purpose}, ${hashCode(user.id, purpose, code)}, ${expiresAt})`;

  // Local development only: print the code so sign-in can be tested without working email
  // delivery. Never logged in production.
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[2fa] DEV ONLY — ${purpose} code for ${user.email}: ${code}`);
  }

  const rendered = twoFactorCodeEmail({ name: user.name ?? user.email, code, purpose });
  await sendEmail({
    to: user.email,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
    kind: 'two_factor_code',
    organizationId: user.organizationId,
  });
  console.log(`[2fa] ${purpose} code issued for ${user.email}; email handed to the mailer`);
  return 'sent';
}

/** Checks a submitted code. Every call (right or wrong) counts as an attempt; a correct code
 * is consumed so it can't be replayed. */
export async function verifyTwoFactorCode(
  userId: string,
  purpose: TwoFactorPurpose,
  submitted: string,
): Promise<boolean> {
  const code = submitted.replace(/\s+/g, '');
  if (!/^\d{6}$/.test(code)) return false;

  // Claim an attempt atomically: only succeeds while the code is live and under the limit.
  const claimed = await prisma.$queryRaw<{ id: string; code_hash: string }[]>`
    UPDATE two_factor_codes SET attempts = attempts + 1
    WHERE id = (
      SELECT id FROM two_factor_codes
      WHERE user_id = ${userId}::uuid AND purpose = ${purpose}
        AND used_at IS NULL AND expires_at > now() AND attempts < ${MAX_ATTEMPTS}
      ORDER BY created_at DESC LIMIT 1
    )
    RETURNING id, code_hash`;
  const row = claimed[0];
  if (!row) return false;

  const expected = Buffer.from(row.code_hash);
  const actual = Buffer.from(hashCode(userId, purpose, code));
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return false;

  await prisma.$executeRaw`UPDATE two_factor_codes SET used_at = now() WHERE id = ${row.id}::uuid`;
  return true;
}

// "Trusted for 24 hours": once a user has passed the emailed-code check on this browser, a
// signed cookie lets them sign in again with just their password until it expires. The cookie
// is bound to the user and to their current password hash, so it stops working if they change
// their password, and it can't be used for anyone else's account.
const TRUST_COOKIE = 'cf_2fa_trust';
const TRUST_TTL_MS = 24 * 60 * 60 * 1000;

function trustSignature(userId: string, expiresAt: number, passwordHash: string): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error('SESSION_SECRET must be set for two-step verification');
  }
  return createHmac('sha256', secret)
    .update(`trust:${userId}:${expiresAt}:${passwordHash.slice(-16)}`)
    .digest('hex');
}

/** True when this browser passed two-step verification for this user within the last 24 hours. */
export async function hasTwoFactorTrust(user: {
  id: string;
  passwordHash: string;
}): Promise<boolean> {
  try {
    const value = (await cookies()).get(TRUST_COOKIE)?.value;
    if (!value) return false;
    const [userId, expires, signature] = value.split('.');
    const expiresAt = Number(expires);
    if (userId !== user.id || !signature || !Number.isFinite(expiresAt)) return false;
    if (expiresAt < Date.now()) return false;
    const expected = Buffer.from(trustSignature(user.id, expiresAt, user.passwordHash));
    const actual = Buffer.from(signature);
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

/** Remembers a successful verification on this browser for 24 hours. */
export async function grantTwoFactorTrust(user: {
  id: string;
  passwordHash: string;
}): Promise<void> {
  try {
    const expiresAt = Date.now() + TRUST_TTL_MS;
    (await cookies()).set(
      TRUST_COOKIE,
      `${user.id}.${expiresAt}.${trustSignature(user.id, expiresAt, user.passwordHash)}`,
      {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: TRUST_TTL_MS / 1000,
      },
    );
  } catch (error) {
    // Never block a successful sign-in because the trust cookie couldn't be written — the
    // user just gets asked for a code again next time.
    console.error('[2fa] could not set trust cookie', error);
  }
}
