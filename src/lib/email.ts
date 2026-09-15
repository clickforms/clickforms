import 'server-only';

import { Resend } from 'resend';
import { prisma } from '@/lib/db';

interface EmailAttachment {
  filename: string;
  content: Buffer;
  contentType?: string;
}

/**
 * Every email this app sends is tagged with one of these — see the `EmailLog.kind`
 * column in prisma/schema.prisma. Kept as a plain string union rather than a DB enum
 * (a migration per new email type would be needless friction); add a case here whenever
 * a new sendEmail() call site is added so EmailLog stays a complete record.
 */
export type EmailKind =
  | 'signup_verification'
  | 'invite'
  | 'platform_admin_invite'
  | 'password_reset'
  | 'submission_notification'
  | 'contact_form';

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text: string;
  attachments?: EmailAttachment[];
  kind: EmailKind;
  /** Scopes the EmailLog row to an organization — omit/null for sends that happen before
   * any org exists (signup verification) or aren't org-scoped at all (platform-admin
   * invites, the public contact form). */
  organizationId?: string | null;
  /** So a reply lands in the sender's own inbox instead of no-reply@ — used by the
   * contact form (reply goes straight to the visitor) rather than the from address. */
  replyTo?: string;
}

// Lazily built and cached — reading env vars at module load time would bake in
// whatever was set (or unset) at import time, which bites in tests/build steps
// that don't set RESEND_API_KEY at all.
let cachedClient: Resend | null = null;

function getClient(): Resend | null {
  if (cachedClient) return cachedClient;
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  cachedClient = new Resend(apiKey);
  return cachedClient;
}

/** Records the outcome of a send attempt — never lets a logging failure surface, since
 * losing an EmailLog row is far less bad than failing (or double-sending) the email
 * itself. No RLS on this table (see the schema comment on EmailLog), so this always goes
 * through the plain `prisma` client regardless of which withOrgContext transaction (if
 * any) the caller is inside. */
async function logEmailAttempt(params: {
  to: string;
  subject: string;
  kind: EmailKind;
  organizationId?: string | null;
  status: 'sent' | 'failed' | 'dev_logged';
  providerMessageId?: string | null;
  error?: string | null;
}): Promise<void> {
  try {
    await prisma.emailLog.create({
      data: {
        toEmail: params.to,
        subject: params.subject,
        kind: params.kind,
        organizationId: params.organizationId ?? null,
        status: params.status,
        providerMessageId: params.providerMessageId ?? null,
        error: params.error ?? null,
      },
    });
  } catch (error) {
    console.error('[email] failed to write EmailLog row', error);
  }
}

/**
 * Sends a transactional email via Resend (RESEND_API_KEY / RESEND_FROM env vars).
 *
 * Dev-mode fallback: when RESEND_API_KEY isn't configured, nothing is actually sent —
 * this logs the message to the console instead, mirroring the existing invite flow's
 * convention of surfacing the link directly rather than requiring real email delivery
 * in local development (see src/app/api/users/route.ts / inviteAcceptUrl usage).
 *
 * Every attempt — sent, failed, or dev-logged — is recorded in EmailLog so delivery
 * problems in production (a bad address, a Resend outage, a domain that fell out of
 * verification) show up somewhere other than server logs.
 */
export async function sendEmail({
  to,
  subject,
  html,
  text,
  attachments,
  kind,
  organizationId,
  replyTo,
}: SendEmailParams): Promise<void> {
  const client = getClient();

  if (!client) {
    const attachmentNote = attachments?.length
      ? ` (with attachment${attachments.length > 1 ? 's' : ''}: ${attachments.map((a) => a.filename).join(', ')})`
      : '';
    console.log(
      `[email] RESEND_API_KEY not configured — logging instead of sending.\nTo: ${to}\nSubject: ${subject}${attachmentNote}\n\n${text}`,
    );
    await logEmailAttempt({ to, subject, kind, organizationId, status: 'dev_logged' });
    return;
  }

  const from = process.env.RESEND_FROM ?? 'Clickforms <no-reply@localhost>';
  const { data, error } = await client.emails.send({
    from,
    to,
    subject,
    html,
    text,
    attachments,
    replyTo,
  });

  if (error) {
    // Never throw — a broken email send shouldn't fail the request that triggered it
    // (e.g. a form submission completing) any more than it did under the old SMTP
    // transport. The caller finds out via EmailLog / server logs, not a thrown error.
    console.error(`[email] Resend send failed (${kind}) to ${to}:`, error);
    await logEmailAttempt({
      to,
      subject,
      kind,
      organizationId,
      status: 'failed',
      error: error.message,
    });
    return;
  }

  await logEmailAttempt({
    to,
    subject,
    kind,
    organizationId,
    status: 'sent',
    providerMessageId: data?.id,
  });
}
