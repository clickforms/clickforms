import { NextResponse } from 'next/server';
import { z } from 'zod';
import { InvalidRequestError, toErrorResponse } from '@/lib/api-errors';
import {
  getFormForExistingSubmission,
  getFormSchemaByVersionId,
  getSubmissionForForm,
} from '@/lib/forms/public-lookup';
import { assertUploadAllowed, buildStorageKey, createPresignedUploadUrl } from '@/lib/s3';
import { resolveOrganizationIdOrThrow } from '@/lib/tenant';

interface RouteContext {
  params: Promise<{ slug: string; submissionId: string }>;
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

// specs/04-submission-handling.md: "client requests a presigned S3 PUT URL scoped to
// org_id/form_id/submission_id/filename... Enforce file size limit and an allowlist of
// MIME types at presign time." Used for file_upload fields, signature images, and
// draw_on_image markups — all three export/upload a PNG blob (or, for file_upload, an
// arbitrary file) through this same flow. Spec 05's full legal-audit-trail Signature
// record (consent text, hash, IP/UA) is a later increment; this pass stores the drawn
// image as a plain submission file.
export async function POST(request: Request, { params }: RouteContext): Promise<NextResponse> {
  try {
    const { slug, submissionId } = await params;
    const body = presignBodySchema.parse(await request.json());

    const organizationId = await resolveOrganizationIdOrThrow();
    const form = await getFormForExistingSubmission(slug, organizationId);
    const submission = await getSubmissionForForm({ formId: form.id, submissionId });

    if (submission.status !== 'in_progress') {
      throw new InvalidRequestError('This submission has already been submitted.');
    }

    const schema = await getFormSchemaByVersionId(submission.formVersionId);
    const field = schema.fields[body.fieldId];
    if (
      !field ||
      (field.type !== 'file_upload' && field.type !== 'signature' && field.type !== 'draw_on_image')
    ) {
      throw new InvalidRequestError(`Field "${body.fieldId}" does not accept file uploads.`);
    }

    assertUploadAllowed({ mimeType: body.mimeType, sizeBytes: body.sizeBytes });

    // Field-level acceptedTypes (spec 02 builder setting) narrows the app-wide allowlist
    // in src/lib/s3.ts further, never widens it. Entries may be MIME types
    // ("application/pdf") or extensions (".pdf") — match either.
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

    const storageKey = buildStorageKey({
      organizationId: form.organizationId,
      formId: form.id,
      submissionId: submission.id,
      filename: body.filename,
    });
    const uploadUrl = await createPresignedUploadUrl({
      storageKey,
      mimeType: body.mimeType,
      sizeBytes: body.sizeBytes,
    });

    return NextResponse.json({ uploadUrl, storageKey });
  } catch (error) {
    return toErrorResponse(error);
  }
}
