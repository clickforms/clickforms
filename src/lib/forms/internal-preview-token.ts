import { createHmac, timingSafeEqual } from 'node:crypto';

// Scopes access to exactly one submission's PDF-preview render, for the one caller that
// has no admin session to prove who's asking: the submission-notification email
// (src/lib/forms/submission-notification.ts), which fires from the unauthenticated
// public submit route. The manual "Download PDF" export (export/pdf/route.ts) already
// has a real admin session and just forwards that session's cookie to Puppeteer instead —
// this token is only for the system/background path, generated and verified entirely
// server-side within a single request and never exposed to a client or stored anywhere.
function secret(): string {
  const value = process.env.SESSION_SECRET;
  if (!value) {
    throw new Error('SESSION_SECRET must be set to generate internal PDF preview tokens');
  }
  return value;
}

export function createInternalPreviewToken(submissionId: string): string {
  return createHmac('sha256', secret()).update(submissionId).digest('hex');
}

/** Constant-time comparison — a submissionId is guessable (it's in the URL already), so
 * the token itself is what actually needs to resist a timing attack. */
export function verifyInternalPreviewToken(submissionId: string, token: string): boolean {
  const expected = Buffer.from(createInternalPreviewToken(submissionId));
  const actual = Buffer.from(token);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
