import 'server-only';

import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { prisma } from '@/lib/db';
import { sendEmail } from '@/lib/email';
import { twoFactorCodeEmail } from '@/lib/emails/templates';
import { log } from '@/lib/log';

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
    log.info('auth.two_factor_throttled', { userId: user.id, email: user.email, purpose });
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
    log.debug('auth.two_factor_dev_preview', { email: user.email, purpose, devOnlyValue: code });
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
  log.info('auth.two_factor_issued', { userId: user.id, email: user.email, purpose });
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

// "Trusted for 24 hours": once a user has passed the emailed-code check, they can sign in with
// just their password, from ANY browser or machine, until 24 hours after that check. The
// record of the check is the used login code itself (used_at), so the trust lives on the
// server, not in a cookie: switching browsers or devices does not ask for a code again.
// It is a fixed window from the last verified code (not extended by trusted sign-ins), and
// revokeTwoFactorTrust() ends it early when the password changes or two-step is reset.
/** True when this user passed two-step verification within the last 24 hours, anywhere. */
export async function hasTwoFactorTrust(user: { id: string }): Promise<boolean> {
  const rows = await prisma.$queryRaw<{ ok: number }[]>`
    SELECT 1 AS ok FROM two_factor_codes
    WHERE user_id = ${user.id}::uuid AND purpose = 'login'
      AND used_at IS NOT NULL
      AND used_at > now() - interval '24 hours'
    LIMIT 1`;
  return rows.length > 0;
}

/** Ends the 24-hour trust immediately (password changed/reset, two-step reset or disabled),
 * so the next sign-in asks for a code. */
export async function revokeTwoFactorTrust(userId: string): Promise<void> {
  await prisma.$executeRaw`
    DELETE FROM two_factor_codes WHERE user_id = ${userId}::uuid AND purpose = 'login'`;
}

/** Starts the 24-hour trust without an emailed code, for a moment that has itself just proved
 * control of the user's inbox (completing a password reset from the emailed link). Two-step
 * codes go to that same inbox, so asking for one straight after adds friction but no security.
 * Recorded the same way a verified code is: a used 'login' row. Older rows are cleared first. */
export async function grantTwoFactorTrust(userId: string): Promise<void> {
  await prisma.$executeRaw`
    DELETE FROM two_factor_codes WHERE user_id = ${userId}::uuid AND purpose = 'login'`;
  await prisma.$executeRaw`
    INSERT INTO two_factor_codes (user_id, purpose, code_hash, attempts, expires_at, used_at)
    VALUES (${userId}::uuid, 'login', 'trust-granted-by-password-reset', 0, now(), now())`;
}
