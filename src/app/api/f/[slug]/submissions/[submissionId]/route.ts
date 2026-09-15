import { NextResponse } from 'next/server';
import { z } from 'zod';
import { InvalidRequestError, toErrorResponse } from '@/lib/api-errors';
import { logAudit } from '@/lib/audit';
import { withOrgContext } from '@/lib/db';
import {
  getFormForExistingSubmission,
  getFormSchemaByVersionId,
  getSubmissionForForm,
} from '@/lib/forms/public-lookup';
import { sendSubmissionNotification } from '@/lib/forms/submission-notification';
import { validateAnswers } from '@/lib/forms/validate-answers';
import { getCurrentSubdomain, resolveOrganizationIdOrThrow } from '@/lib/tenant';

interface RouteContext {
  params: Promise<{ slug: string; submissionId: string }>;
}

const answersBodySchema = z.object({
  answers: z.record(z.string(), z.union([z.string(), z.array(z.string())])),
});

// Final submit — specs/03/04: server-side re-validation "if the client check is
// bypassed via direct API call" is not optional. Re-validates against the exact
// form_version the submission was created against (not whatever's currently published),
// so a mid-fill republish (spec 03 acceptance criteria) never invalidates answers
// already in progress.
export async function PATCH(request: Request, { params }: RouteContext): Promise<NextResponse> {
  try {
    const { slug, submissionId } = await params;
    const body = answersBodySchema.parse(await request.json());

    const organizationId = await resolveOrganizationIdOrThrow();
    const form = await getFormForExistingSubmission(slug, organizationId);
    const submission = await getSubmissionForForm({ formId: form.id, submissionId });

    if (submission.status !== 'in_progress') {
      throw new InvalidRequestError('This submission has already been submitted.');
    }

    const schema = await getFormSchemaByVersionId(submission.formVersionId);

    // Every file_upload/signature answer must reference a submission_files row that was
    // actually uploaded against *this* submission — otherwise a client could forge a
    // fileId belonging to a different org's submission into its answers.
    const uploadedFiles = await withOrgContext(form.organizationId, (tx) =>
      tx.submissionFile.findMany({ where: { submissionId: submission.id }, select: { id: true } }),
    );
    const uploadedFileIds = new Set(uploadedFiles.map((file) => file.id));

    for (const [fieldId, field] of Object.entries(schema.fields)) {
      if (field.type !== 'file_upload' && field.type !== 'signature') continue;
      const value = body.answers[fieldId];
      if (value === undefined) continue;
      const fileIds = Array.isArray(value) ? value : [value];
      for (const fileId of fileIds) {
        if (!uploadedFileIds.has(fileId)) {
          throw new InvalidRequestError(
            `Field "${fieldId}" references a file that was not uploaded to this submission.`,
          );
        }
      }
    }

    const fieldErrors = validateAnswers(schema, body.answers);
    if (Object.keys(fieldErrors).length > 0) {
      return NextResponse.json({ error: 'Validation failed', fieldErrors }, { status: 400 });
    }

    const { updated, organizationNotificationEmail } = await withOrgContext(
      form.organizationId,
      async (tx) => {
        const result = await tx.submission.update({
          where: { id: submission.id },
          data: { answers: body.answers, status: 'submitted', submittedAt: new Date() },
        });

        await logAudit(
          {
            organizationId: form.organizationId,
            actorUserId: null,
            action: 'submission.submit',
            entityType: 'submission',
            entityId: result.id,
            metadata: { formId: form.id, formVersionId: submission.formVersionId },
          },
          tx,
        );

        const organization = await tx.organization.findUnique({
          where: { id: form.organizationId },
          select: { notificationEmail: true },
        });

        return {
          updated: result,
          organizationNotificationEmail: organization?.notificationEmail ?? null,
        };
      },
    );

    // Fire-and-forget: rendering the PDF attachment takes a few seconds and a slow/broken
    // SMTP server must never delay or fail the respondent's own submit request — see
    // sendSubmissionNotification's own docs for why every error inside it is caught.
    const subdomain = await getCurrentSubdomain();
    if (subdomain) {
      void sendSubmissionNotification({
        organizationSubdomain: subdomain,
        form: {
          id: form.id,
          name: form.name,
          slug: form.slug,
          organizationId: form.organizationId,
          notificationMode: form.notificationMode,
          notificationEmail: form.notificationEmail,
          pdfFilenameTemplate: form.pdfFilenameTemplate,
          filenamePrefixFieldId: form.filenamePrefixFieldId,
        },
        submission: {
          id: updated.id,
          formVersionId: updated.formVersionId,
          submittedAt: updated.submittedAt,
          answers: updated.answers as Record<string, unknown>,
        },
        organizationNotificationEmail,
      }).catch((error) => {
        console.error(
          `[notifications] submission notification failed for submission ${updated.id}`,
          error,
        );
      });
    }

    return NextResponse.json({ submissionId: updated.id, status: updated.status });
  } catch (error) {
    return toErrorResponse(error);
  }
}
