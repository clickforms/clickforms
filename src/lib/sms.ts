import 'server-only';

import { prisma } from '@/lib/db';

/**
 * Every SMS this app sends is tagged with one of these — see SmsLog.kind in
 * prisma/schema.prisma, same "plain string union, not a DB enum" convention as
 * EmailKind in src/lib/email.ts. Currently just the one flow (POST
 * /api/forms/[id]/share); add a case here whenever a new sendSms() call site is added.
 */
export type SmsKind = 'form_share';

interface SendSmsParams {
  to: string;
  message: string;
  kind: SmsKind;
  organizationId?: string | null;
}

/**
 * MessageMedia (rebranded Sinch Engage, same underlying REST API) response shape for
 * POST /v1/messages — only the fields this module actually reads.
 */
interface MessageMediaSendResponse {
  messages?: Array<{ message_id?: string; status?: string }>;
}

interface MessageMediaCredentials {
  apiKey: string;
  apiSecret: string;
  senderId: string | null;
}

// Lazily read and cached, same reasoning as email.ts's getClient(): reading env vars at
// module load time would bake in whatever was (un)set at import time, which bites tests
// and build steps that don't set these at all.
let cachedCredentials: MessageMediaCredentials | null | undefined;

function getCredentials(): MessageMediaCredentials | null {
  if (cachedCredentials !== undefined) return cachedCredentials;
  const apiKey = process.env.MESSAGEMEDIA_API_KEY;
  const apiSecret = process.env.MESSAGEMEDIA_API_SECRET;
  if (!apiKey || !apiSecret) {
    cachedCredentials = null;
    return null;
  }
  cachedCredentials = {
    apiKey,
    apiSecret,
    senderId: process.env.MESSAGEMEDIA_SENDER_ID || null,
  };
  return cachedCredentials;
}

/** Mirrors email.ts's logEmailAttempt() — never lets a logging failure surface, since
 * losing an SmsLog row is far less bad than failing (or double-sending) the message
 * itself. Always goes through the plain `prisma` client (no RLS on this table, same as
 * EmailLog) regardless of which withOrgContext transaction (if any) the caller is in. */
async function logSmsAttempt(params: {
  to: string;
  kind: SmsKind;
  organizationId?: string | null;
  status: 'sent' | 'failed' | 'dev_logged';
  providerMessageId?: string | null;
  error?: string | null;
}): Promise<void> {
  try {
    await prisma.smsLog.create({
      data: {
        toPhone: params.to,
        kind: params.kind,
        organizationId: params.organizationId ?? null,
        status: params.status,
        providerMessageId: params.providerMessageId ?? null,
        error: params.error ?? null,
      },
    });
  } catch (error) {
    console.error('[sms] failed to write SmsLog row', error);
  }
}

/**
 * Sends an SMS via MessageMedia/Sinch Engage's Messages API (MESSAGEMEDIA_API_KEY /
 * MESSAGEMEDIA_API_SECRET / MESSAGEMEDIA_SENDER_ID env vars).
 *
 * Dev-mode fallback: when credentials aren't configured, nothing is actually sent —
 * this logs the message to the console instead, mirroring sendEmail()'s convention so
 * local development needs no real MessageMedia account.
 *
 * Every attempt — sent, failed, or dev-logged — is recorded in SmsLog, same as EmailLog.
 */
export async function sendSms({ to, message, kind, organizationId }: SendSmsParams): Promise<void> {
  const credentials = getCredentials();

  if (!credentials) {
    console.log(
      `[sms] MESSAGEMEDIA_API_KEY/MESSAGEMEDIA_API_SECRET not configured — logging instead of sending.\nTo: ${to}\n\n${message}`,
    );
    await logSmsAttempt({ to, kind, organizationId, status: 'dev_logged' });
    return;
  }

  try {
    const basicAuth = Buffer.from(`${credentials.apiKey}:${credentials.apiSecret}`).toString(
      'base64',
    );
    const response = await fetch('https://api.messagemedia.com/v1/messages', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basicAuth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [
          {
            content: message,
            destination_number: to,
            ...(credentials.senderId ? { source_number: credentials.senderId } : {}),
          },
        ],
      }),
    });

    const body = (await response.json().catch(() => null)) as MessageMediaSendResponse | null;

    if (!response.ok) {
      // Never throw — a broken SMS send shouldn't fail the request that triggered it,
      // same reasoning as sendEmail(). The caller finds out via SmsLog / server logs.
      const errorMessage = `MessageMedia responded ${response.status}`;
      console.error(`[sms] MessageMedia send failed (${kind}) to ${to}:`, errorMessage, body);
      await logSmsAttempt({ to, kind, organizationId, status: 'failed', error: errorMessage });
      return;
    }

    await logSmsAttempt({
      to,
      kind,
      organizationId,
      status: 'sent',
      providerMessageId: body?.messages?.[0]?.message_id ?? null,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[sms] MessageMedia send failed (${kind}) to ${to}:`, error);
    await logSmsAttempt({ to, kind, organizationId, status: 'failed', error: errorMessage });
  }
}
