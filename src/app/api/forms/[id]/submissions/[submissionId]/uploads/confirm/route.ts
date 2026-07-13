import { NextResponse } from 'next/server';
import { z } from 'zod';
import { InvalidRequestError, NotFoundError, toErrorResponse } from '@/lib/api-errors';
import { withOrgContext } from '@/lib/db';
import { assertFormEditAccess } from '@/lib/form-access';
import { loadSubmissionFormSchema } from '@/lib/forms/submission-files';
import { assertUploadAllowed } from '@/lib/s3';
import { requireSession } from '@/lib/session';

interface RouteContext {
  params: Promise<{ id: string; submissionId: string }>;
}

const confirmBodySchema = z.object({
  fieldId: z.string().min(1),
  storageKey: z.string().min(1),
  filename: z.string().min(1).max(255),
  mimeType: z.string().min(1),
  sizeBytes: z.number().int().positive(),
});

/**
 * Admin-side counterpart to POST /api/f/[slug]/submissions/[submissionId]/uploads/confirm
 * — written only after the client's direct PUT to S3 (using the presigned URL from the
 * sibling presign route) has actually succeeded. See that route's comment for why this
 * pair exists separately from the public respondent flow.
 */
export async function POST(request: Request, { params }: RouteContext): Promise<NextResponse> {
  try {
    const session = await requireSession();
    const { id, submissionId } = await params;
    const body = confirmBodySchema.parse(await request.json());

    const fileId = await withOrgContext(session.user.organizationId, async (tx) => {
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

      // storageKey must actually be scoped under this org/form/submission — guards
      // against a forged confirm call pointing at an unrelated S3 key.
      const expectedPrefix = `${form.organizationId}/${form.id}/${submission.id}/`;
      if (!body.storageKey.startsWith(expectedPrefix)) {
        throw new InvalidRequestError('storageKey does not belong to this submission.');
      }

      const schema = await loadSubmissionFormSchema(tx, submission, session.user.organizationId);
      const field = schema.fields[body.fieldId];
      if (!field || (field.type !== 'file_upload' && field.type !== 'signature')) {
        throw new InvalidRequestError(`Field "${body.fieldId}" does not accept file uploads.`);
      }

      assertUploadAllowed({ mimeType: body.mimeType, sizeBytes: body.sizeBytes });

      const file = await tx.submissionFile.create({
        data: {
          submissionId: submission.id,
          organizationId: form.organizationId,
          fieldKey: body.fieldId,
          storageKey: body.storageKey,
          filename: body.filename,
          mimeType: body.mimeType,
          sizeBytes: body.sizeBytes,
        },
      });

      return file.id;
    });

    return NextResponse.json({ fileId }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
