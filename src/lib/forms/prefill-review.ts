import 'server-only';

import type { FormNotificationMode } from '@prisma/client';
import { sendEmail } from '@/lib/email';
import { prefillReturnedEmail } from '@/lib/emails/templates';
import { resolveNotificationRecipient } from '@/lib/forms/submission-notification';
import { log } from '@/lib/log';

export function adminPrefillUrl(formId: string, prefillId: string): string {
  const base = process.env.NEXTAUTH_URL ?? 'http://localhost:3000';
  return `${base.replace(/\/$/, '')}/forms/${formId}/prefills/${prefillId}`;
}

/** Tells the form's notification address that a prefilled form came back and is awaiting review.
 * Best-effort and never throws — a mail problem must not affect the respondent's submit. */
export async function notifyPrefillReturned(params: {
  organizationId: string;
  form: {
    id: string;
    name: string;
    notificationMode: FormNotificationMode;
    notificationEmail: string | null;
  };
  prefillId: string;
  recipientLabel: string;
  organizationNotificationEmail: string | null;
}): Promise<void> {
  try {
    const to = resolveNotificationRecipient(
      params.form.notificationMode,
      params.form.notificationEmail,
      params.organizationNotificationEmail,
    );
    if (!to) return;
    const { subject, html, text } = prefillReturnedEmail({
      formName: params.form.name,
      recipientLabel: params.recipientLabel,
      reviewUrl: adminPrefillUrl(params.form.id, params.prefillId),
    });
    await sendEmail({
      to,
      subject,
      html,
      text,
      kind: 'prefill_returned',
      organizationId: params.organizationId,
    });
  } catch (error) {
    log.error('notification.prefill_review_failed', { error });
  }
}
