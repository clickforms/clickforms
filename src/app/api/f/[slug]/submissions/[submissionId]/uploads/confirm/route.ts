import { NextResponse } from 'next/server';
import { z } from 'zod';
import { InvalidRequestError, toErrorResponse } from '@/lib/api-errors';
import { withOrgContext } from '@/lib/db';
import {
  getFormSchemaByVersionId,
  getPublishedFormBySlug,
  getSubmissionForForm,
} from '@/lib/forms/public-lookup';
import { assertUploadAllowed } from '@/lib/s3';

interface RouteContext {
  params: Promise<{ slug: string; submissionId: string }>;
}

const confirmBodySchema = z.object({
  fieldId: z.string().min(1),
  storageKey: z.string().min(1),
  filename: z.string().min(1).max(255),
  mimeType: z.string().min(1),
  sizeBytes: z.number().int().positive(),
});

// Written only after the client's direct PUT to S3 (using the presigned URL from
// .../uploads/presign) has actually succeeded — this is what turns "a file exists at
// some S3 key" into a submission_files row the admin submission-detail view can list.
export async function POST(request: Request, { params }: RouteContext): Promise<NextResponse> {
  try {
    const { slug, submissionId } = await params;
    const body = confirmBodySchema.parse(await request.json());

    const form = await getPublishedFormBySlug(slug);
    const submission = await getSubmissionForForm({ formId: form.id, submissionId });

    if (submission.status !== 'in_progress') {
      throw new InvalidRequestError('This submission has already been submitted.');
    }

    // storageKey must actually be scoped under this org/form/submission — guards against
    // a forged confirm call pointing at an unrelated S3 key.
    const expectedPrefix = `${form.organizationId}/${form.id}/${submission.id}/`;
    if (!body.storageKey.startsWith(expectedPrefix)) {
      throw new InvalidRequestError('storageKey does not belong to this submission.');
    }

    const schema = await getFormSchemaByVersionId(submission.formVersionId);
    const field = schema.fields[body.fieldId];
    if (!field || (field.type !== 'file_upload' && field.type !== 'signature')) {
      throw new InvalidRequestError(`Field "${body.fieldId}" does not accept file uploads.`);
    }

    assertUploadAllowed({ mimeType: body.mimeType, sizeBytes: body.sizeBytes });

    const file = await withOrgContext(form.organizationId, (tx) =>
      tx.submissionFile.create({
        data: {
          submissionId: submission.id,
          organizationId: form.organizationId,
          fieldKey: body.fieldId,
          storageKey: body.storageKey,
          filename: body.filename,
          mimeType: body.mimeType,
          sizeBytes: body.sizeBytes,
        },
      }),
    );

    return NextResponse.json({ fileId: file.id }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
