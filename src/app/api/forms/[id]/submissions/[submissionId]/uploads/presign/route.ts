import { NextResponse } from 'next/server';
import { z } from 'zod';
import { InvalidRequestError, NotFoundError, toErrorResponse } from '@/lib/api-errors';
import { withOrgContext } from '@/lib/db';
import { assertFormEditAccess } from '@/lib/form-access';
import { loadSubmissionFormSchema } from '@/lib/forms/submission-files';
import { assertUploadAllowed, buildStorageKey, createPresignedUploadUrl } from '@/lib/s3';
import { requireSession } from '@/lib/session';

interface RouteContext {
  params: Promise<{ id: string; submissionId: string }>;
}

const presignBodySchema = z.object({
  fieldId: z.string().min(1),
  filename: z.string().min(1).max(255),
  mimeType: z.string().min(1),
  sizeBytes: z.number().int().positive(),
});

function extensionOf(filename: string): string {
  const dot = filename.lastIndexOf('.');
  return dot === -1 ? '' : filename.slice(dot).toLowerCase();
}

/**
 * Admin-side counterpart to POST /api/f/[slug]/submissions/[submissionId]/uploads/presign.
 * That public route only exists for a respondent actively filling out a form and
 * deliberately refuses once the submission has left "in_progress" — this route is what
 * lets a manager attach a replacement file/signature to a response that's already been
 * submitted (see the submission-edit feature: SubmissionAnswersEditor). Gated by
 * assertFormEditAccess (same trust boundary as editing the form itself, matching the
 * DELETE handler in ../route.ts) instead of the public slug lookup.
 */
export async function POST(request: Request, { params }: RouteContext): Promise<NextResponse> {
  try {
    const session = await requireSession();
    const { id, submissionId } = await params;
    const body = presignBodySchema.parse(await request.json());

    const target = await withOrgContext(session.user.organizationId, async (tx) => {
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
      const field = schema.fields[body.fieldId];
      if (!field || (field.type !== 'file_upload' && field.type !== 'signature')) {
        throw new InvalidRequestError(`Field "${body.fieldId}" does not accept file uploads.`);
      }

      assertUploadAllowed({ mimeType: body.mimeType, sizeBytes: body.sizeBytes });

      // Field-level acceptedTypes (spec 02 builder setting) narrows the app-wide
      // allowlist further, never widens it — same check as the public presign route.
      if (field.type === 'file_upload' && field.validation?.acceptedTypes?.length) {
        const extension = extensionOf(body.filename);
        const allowed = field.validation.acceptedTypes.some(
          (entry) => entry === body.mimeType || entry.toLowerCase() === extension,
        );
        if (!allowed) {
          throw new InvalidRequestError(
            `This field only accepts: ${field.validation.acceptedTypes.join(', ')}`,
          );
        }
      }

      return { organizationId: form.organizationId, formId: form.id, submissionId: submission.id };
    });

    const storageKey = buildStorageKey({ ...target, filename: body.filename });
    const uploadUrl = await createPresignedUploadUrl({ storageKey, mimeType: body.mimeType });

    return NextResponse.json({ uploadUrl, storageKey });
  } catch (error) {
    return toErrorResponse(error);
  }
}
