import { NextResponse } from 'next/server';
import { z } from 'zod';
import { InvalidRequestError, NotFoundError, toErrorResponse } from '@/lib/api-errors';
import { logAudit } from '@/lib/audit';
import { withOrgContext } from '@/lib/db';
import { assertFormEditAccess } from '@/lib/form-access';
import { loadSubmissionFormSchema, parseSubmissionAnswers } from '@/lib/forms/submission-files';
import { validateAnswers } from '@/lib/forms/validate-answers';
import { requireSession } from '@/lib/session';

interface RouteContext {
  params: Promise<{ id: string; submissionId: string }>;
}

const answersBodySchema = z.object({
  answers: z.record(z.string(), z.union([z.string(), z.array(z.string())])),
});

/**
 * Permanently deletes a single submission and its related rows (SubmissionFile,
 * Signature, WorkflowStep all cascade via the FK `onDelete: Cascade` in schema.prisma —
 * see the `Submission` model). Matches the DB-only delete convention used by
 * DELETE /api/forms/[id] (delete-form.ts) and DELETE /api/files/[id]: the S3 objects
 * referenced by any SubmissionFile rows are left in place for later cleanup rather than
 * deleted inline here.
 *
 * Gated the same way as editing the form itself (assertFormEditAccess) rather than a
 * separate "can delete responses" permission — deleting a response is a form-management
 * action, same trust boundary as archiving or publishing it.
 */
export async function DELETE(_request: Request, { params }: RouteContext): Promise<NextResponse> {
  try {
    const session = await requireSession();
    const { id, submissionId } = await params;

    await withOrgContext(session.user.organizationId, async (tx) => {
      const form = await tx.form.findFirst({
        where: { id, organizationId: session.user.organizationId },
      });
      assertFormEditAccess(form, session.user.role, session.user.id);

      const submission = await tx.submission.findFirst({
        where: { id: submissionId, formId: form.id, organizationId: session.user.organizationId },
        select: { id: true, status: true, submittedAt: true },
      });
      if (!submission) {
        throw new NotFoundError('Submission');
      }

      await tx.submission.delete({ where: { id: submission.id } });

      await logAudit(
        {
          organizationId: session.user.organizationId,
          actorUserId: session.user.id,
          action: 'submission.delete',
          entityType: 'submission',
          entityId: submission.id,
          metadata: {
            formId: form.id,
            status: submission.status,
            submittedAt: submission.submittedAt,
          },
        },
        tx,
      );
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return toErrorResponse(error);
  }
}

/**
 * Lets a manager (same trust boundary as assertFormEditAccess — form editors/admins,
 * or a member editing their own form) correct a response after the respondent has
 * already submitted it. Deliberately narrower than the public respondent PATCH
 * (/api/f/[slug]/submissions/[submissionId]): it only ever overwrites `answers`, never
 * `status` or `submittedAt` — an admin fixing a typo shouldn't reopen or re-timestamp
 * the submission. Re-validates against the exact form_version the submission was
 * created against (see loadSubmissionFormSchema), same as the respondent flow, so an
 * edit can't be saved into a shape the schema no longer allows.
 */
export async function PATCH(request: Request, { params }: RouteContext): Promise<NextResponse> {
  try {
    const session = await requireSession();
    const { id, submissionId } = await params;
    const body = answersBodySchema.parse(await request.json());

    const result = await withOrgContext(session.user.organizationId, async (tx) => {
      const form = await tx.form.findFirst({
        where: { id, organizationId: session.user.organizationId },
      });
      assertFormEditAccess(form, session.user.role, session.user.id);

      const submission = await tx.submission.findFirst({
        where: { id: submissionId, formId: form.id, organizationId: session.user.organizationId },
      });
      if (!submission) {
        throw new NotFoundError('Submission');
      }

      const schema = await loadSubmissionFormSchema(tx, submission, session.user.organizationId);

      // Every file_upload/signature answer must reference a submission_files row that
      // actually belongs to *this* submission — otherwise a forged fileId could point at
      // another org's file (same guard as the public respondent PATCH route).
      const uploadedFiles = await tx.submissionFile.findMany({
        where: { submissionId: submission.id, organizationId: session.user.organizationId },
        select: { id: true },
      });
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
        return { fieldErrors };
      }

      const previousAnswers = parseSubmissionAnswers(submission);
      const changedFieldIds = Object.keys({ ...previousAnswers, ...body.answers }).filter(
        (fieldId) =>
          JSON.stringify(previousAnswers[fieldId]) !== JSON.stringify(body.answers[fieldId]),
      );

      const updated = await tx.submission.update({
        where: { id: submission.id },
        data: { answers: body.answers },
      });

      await logAudit(
        {
          organizationId: session.user.organizationId,
          actorUserId: session.user.id,
          action: 'submission.edit',
          entityType: 'submission',
          entityId: updated.id,
          metadata: { formId: form.id, changedFieldIds },
        },
        tx,
      );

      return { submission: updated };
    });

    if ('fieldErrors' in result) {
      return NextResponse.json(
        { error: 'Validation failed', fieldErrors: result.fieldErrors },
        {
          status: 400,
        },
      );
    }

    return NextResponse.json({
      submissionId: result.submission.id,
      status: result.submission.status,
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
