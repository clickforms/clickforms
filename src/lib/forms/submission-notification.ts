import type { FormNotificationMode } from '@prisma/client';
import { withOrgContext } from '@/lib/db';
import { sendEmail } from '@/lib/email';
import { submissionNotificationEmail } from '@/lib/emails/templates';
import {
  appendUploadedPdfPages,
  findUploadedPdfAttachments,
  generateSubmissionPdfFromPreviewUrl,
  resolveFilenamePrefixValue,
  submissionPdfFilename,
} from '@/lib/forms/generate-submission-pdf';
import { createInternalPreviewToken } from '@/lib/forms/internal-preview-token';
import { getFormSchemaByVersionId } from '@/lib/forms/public-lookup';
import { listFilenamePrefixCandidates } from '@/lib/forms/schema';
import { buildOrgFormUrl } from '@/lib/tenant';

/** Which address (if any) a form's "new response" email should go to — org_default
 * defers to the org's own setting, custom uses the form's own address, off never sends.
 * A pure function of the three inputs so it's trivial to reason about/test independently
 * of where those values come from (org settings page vs. form settings page). */
export function resolveNotificationRecipient(
  notificationMode: FormNotificationMode,
  formNotificationEmail: string | null,
  organizationNotificationEmail: string | null,
): string | null {
  if (notificationMode === 'off') return null;
  if (notificationMode === 'custom') return formNotificationEmail;
  return organizationNotificationEmail;
}

/** Best-effort "who filled this in" label for the email body — reuses the same
 * text-like-field eligibility list the PDF filename prefix picker uses (schema.ts), and
 * just looks for one whose label reads like a name. Most forms have one; some don't, or
 * the respondent left it blank — either way this degrades to no hint rather than guessing. */
function findRespondentHint(
  schema: Parameters<typeof listFilenamePrefixCandidates>[0],
  answers: Record<string, unknown>,
): string | null {
  const candidates = listFilenamePrefixCandidates(schema);
  const nameField = candidates.find((candidate) => /\bname\b/i.test(candidate.label));
  if (!nameField) return null;
  const value = answers[nameField.id];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function adminSubmissionUrl(formId: string, submissionId: string): string {
  const base = process.env.NEXTAUTH_URL ?? 'http://localhost:3000';
  return `${base.replace(/\/$/, '')}/forms/${formId}/submissions/${submissionId}`;
}

export interface SubmissionNotificationParams {
  organizationSubdomain: string;
  form: {
    id: string;
    name: string;
    slug: string;
    organizationId: string;
    notificationMode: FormNotificationMode;
    notificationEmail: string | null;
    pdfFilenameTemplate: string | null;
    filenamePrefixFieldId: string | null;
  };
  submission: {
    id: string;
    formVersionId: string;
    submittedAt: Date | null;
    answers: Record<string, unknown>;
  };
  organizationNotificationEmail: string | null;
}

/**
 * Fires the "new response" email for a just-submitted form, if this form/org combination
 * has a recipient configured (see resolveNotificationRecipient). Called fire-and-forget
 * (not awaited) from PATCH /api/f/[slug]/submissions/[submissionId] — rendering the PDF
 * attachment takes a few seconds (headless Chromium, same as the manual "Download PDF"
 * export) and a broken/slow SMTP server shouldn't hold up a respondent's submit request
 * or fail their submission over an internal notification problem, so every error here is
 * caught and logged rather than thrown.
 */
export async function sendSubmissionNotification(
  params: SubmissionNotificationParams,
): Promise<void> {
  const recipient = resolveNotificationRecipient(
    params.form.notificationMode,
    params.form.notificationEmail,
    params.organizationNotificationEmail,
  );
  if (!recipient) return;

  const schema = await getFormSchemaByVersionId(params.submission.formVersionId);
  const respondentHint = findRespondentHint(schema, params.submission.answers);

  let attachments: { filename: string; content: Buffer }[] | undefined;
  try {
    const previewToken = createInternalPreviewToken(params.submission.id);
    const previewUrl = `${buildOrgFormUrl(
      params.organizationSubdomain,
      `/f/${params.form.slug}/submissions/${params.submission.id}/preview`,
    )}?internalToken=${previewToken}`;

    const summaryPdf = await generateSubmissionPdfFromPreviewUrl(previewUrl, null);
    const pdfAttachmentsMeta = await withOrgContext(params.form.organizationId, (tx) =>
      findUploadedPdfAttachments(
        tx,
        schema,
        params.submission.answers,
        params.submission.id,
        params.form.organizationId,
      ),
    );
    const mergedPdf = await appendUploadedPdfPages(summaryPdf, pdfAttachmentsMeta);

    const prefixValue = resolveFilenamePrefixValue(
      params.submission.answers,
      params.form.filenamePrefixFieldId,
    );
    const filename = submissionPdfFilename(
      params.form.name,
      params.submission.submittedAt,
      params.form.pdfFilenameTemplate,
      params.submission.answers,
      prefixValue,
    );

    attachments = [{ filename, content: mergedPdf }];
  } catch (error) {
    // The notification is still worth sending without its attachment — a broken PDF
    // render shouldn't also swallow the "someone responded" alert itself.
    console.error(
      `[notifications] failed to render PDF attachment for submission ${params.submission.id}`,
      error,
    );
  }

  const { subject, html, text } = submissionNotificationEmail({
    formName: params.form.name,
    submittedAt: params.submission.submittedAt ?? new Date(),
    viewUrl: adminSubmissionUrl(params.form.id, params.submission.id),
    respondentHint,
  });

  await sendEmail({
    to: recipient,
    subject,
    html,
    text,
    attachments,
    kind: 'submission_notification',
    organizationId: params.form.organizationId,
  });
}
