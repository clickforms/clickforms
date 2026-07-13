import nodemailer from 'nodemailer';

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text: string;
}

// Lazily built and cached — reading env vars at module load time would bake in
// whatever was set (or unset) at import time, which bites in tests/build steps
// that don't set SMTP_* at all.
let cachedTransport: ReturnType<typeof nodemailer.createTransport> | null = null;

function getTransport() {
  if (cachedTransport) return cachedTransport;

  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT ?? '587');
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;

  if (!host) return null;

  cachedTransport = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: user && pass ? { user, pass } : undefined,
  });
  return cachedTransport;
}

/**
 * Sends a transactional email via SMTP (SMTP_HOST/PORT/USER/PASSWORD/FROM env vars).
 *
 * Dev-mode fallback: when SMTP_HOST isn't configured, nothing is actually sent —
 * this logs the message to the console instead, mirroring the existing invite flow's
 * convention of surfacing the link directly rather than requiring real email delivery
 * in local development (see src/app/api/users/route.ts / inviteAcceptUrl usage).
 */
export async function sendEmail({ to, subject, html, text }: SendEmailParams): Promise<void> {
  const transport = getTransport();

  if (!transport) {
    console.log(
      `[email] SMTP not configured — logging instead of sending.\nTo: ${to}\nSubject: ${subject}\n\n${text}`,
    );
    return;
  }

  const from = process.env.SMTP_FROM ?? 'Clickforms <no-reply@localhost>';
  await transport.sendMail({ from, to, subject, html, text });
}
