import 'server-only';

import { sendEmail } from '@/lib/email';
import { formShareEmail } from '@/lib/emails/templates';
import { buildOrgFormUrl } from '@/lib/tenant';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function prefillUrl(subdomain: string, slug: string, token: string): string {
  return `${buildOrgFormUrl(subdomain, `/f/${slug}`)}?prefill=${token}`;
}

/** Emails a recipient their prefilled form link. Same layout as the Share panel's email, with a
 * body that says the details are already filled in and the link expires. `note` is the sender's
 * optional personal message (plain text — escaped here). */
export async function sendPrefillEmail(params: {
  to: string;
  recipientName?: string | null;
  senderName: string;
  formName: string;
  url: string;
  note?: string | null;
  expiresAt: Date;
  organizationId: string;
  /** A returned response sent back for a correction, rather than a first prefill. */
  correction?: boolean;
}): Promise<void> {
  const greeting = params.recipientName?.trim()
    ? `Hello ${escapeHtml(params.recipientName.trim())},`
    : 'Hello,';
  const expires = params.expiresAt.toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const noteHtml = params.note?.trim()
    ? `<p style="text-align: center"><em>${escapeHtml(params.note.trim()).replace(/\n/g, '<br>')}</em></p>`
    : '';
  const intro = params.correction
    ? `${escapeHtml(params.senderName)} has sent your response to &quot;${escapeHtml(params.formName)}&quot; back to you for a correction.`
    : `${escapeHtml(params.senderName)} has started the form &quot;${escapeHtml(params.formName)}&quot; for you, with some of your details already filled in.`;
  const action = params.correction
    ? `Your previous answers are filled in. Please fix what needs changing and submit again. This link is personal to you and expires on ${expires}.`
    : `Please review the answers, complete the rest, and submit. This link is personal to you and expires on ${expires}.`;
  const message =
    `<p style="text-align: center">${greeting}</p>` +
    `<p style="text-align: center">${intro}</p>` +
    noteHtml +
    `<p style="text-align: center">${action}</p>`;

  const { subject, html, text } = formShareEmail({
    senderName: params.senderName,
    formName: params.formName,
    formUrl: params.url,
    message,
  });
  await sendEmail({
    to: params.to,
    subject,
    html,
    text,
    kind: 'form_prefill',
    organizationId: params.organizationId,
  });
}
