import { NextResponse } from 'next/server';
import { NotFoundError, toErrorResponse } from '@/lib/api-errors';
import { withOrgContext } from '@/lib/db';
import { buildSubmissionExportAssets } from '@/lib/forms/build-submission-export-assets';
import type { FormAnswers } from '@/lib/forms/conditional-logic';
import type { ResolvedSubmissionFile } from '@/lib/forms/format-submission-answer';
import { createEmptyFormSchema, type FormSchema, formSchemaSchema } from '@/lib/forms/schema';
import {
  buildSubmissionFileMaps,
  createDownloadUrlMap,
  createSubmissionFileResolver,
  parseSubmissionAnswers,
} from '@/lib/forms/submission-files';
import { requireOrganizationId, requireSession } from '@/lib/session';

interface RouteContext {
  params: Promise<{ id: string; submissionId: string }>;
}

/**
 * JSON payload for the Responses table's in-modal preview. The modal used to iframe
 * /f/[slug]/submissions/[id]/preview, but that page lives on the public-form host and
 * production sets X-Frame-Options such that the apex /forms workspace cannot display it
 * (the iframe ends up on clickforms.com.au/ and the browser blocks it). Rendering the
 * same export document in the modal avoids framing entirely. Anyone who can open the
 * responses list can load this — same org-scoped session gate as the list page, not
 * assertFormEditAccess (viewers still need to preview).
 */
export async function GET(_request: Request, { params }: RouteContext): Promise<NextResponse> {
  try {
    const session = await requireSession();
    const { id, submissionId } = await params;
    const organizationId = requireOrganizationId(session);

    const result = await withOrgContext(organizationId, async (tx) => {
      const form = await tx.form.findFirst({
        where: { id, organizationId },
      });
      if (!form) return null;

      const submission = await tx.submission.findFirst({
        where: { id: submissionId, formId: form.id, organizationId },
      });
      if (!submission) return null;

      const version = await tx.formVersion.findFirst({
        where: { id: submission.formVersionId, organizationId },
      });

      const files = await tx.submissionFile.findMany({
        where: { submissionId: submission.id, organizationId },
      });

      return { form, submission, version, files };
    });

    if (!result) {
      throw new NotFoundError('Submission');
    }

    const { form, submission, version, files } = result;

    let schema: FormSchema;
    if (version) {
      const parsed = formSchemaSchema.safeParse(version.schema);
      schema = parsed.success ? parsed.data : createEmptyFormSchema();
    } else {
      schema = createEmptyFormSchema();
    }

    const downloadUrlById = await createDownloadUrlMap(files);
    const { filesById, filesByFieldKey } = buildSubmissionFileMaps(files);
    const answers = parseSubmissionAnswers(submission) as FormAnswers;
    const resolveFiles = createSubmissionFileResolver(
      answers,
      filesById,
      filesByFieldKey,
      downloadUrlById,
    );
    const assets = await buildSubmissionExportAssets({ schema, files, resolveFiles });

    const filesByFieldId: Record<string, ResolvedSubmissionFile[]> = {};
    for (const fieldId of Object.keys(schema.fields)) {
      const resolved = resolveFiles(fieldId);
      if (resolved.length > 0) {
        filesByFieldId[fieldId] = resolved;
      }
    }

    const payload = {
      formName: form.name,
      schema,
      answers,
      assets,
      filesByFieldId,
    };

    return NextResponse.json(payload);
  } catch (error) {
    return toErrorResponse(error);
  }
}
