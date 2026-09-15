import { NextResponse } from 'next/server';
import { NotFoundError, toErrorResponse } from '@/lib/api-errors';
import { withOrgContext } from '@/lib/db';
import { assertFormEditAccess } from '@/lib/form-access';
import {
  appendUploadedPdfPages,
  findUploadedPdfAttachments,
  generateSubmissionPdfFromPreviewUrl,
  resolveFilenamePrefixValue,
  submissionPdfFilename,
} from '@/lib/forms/generate-submission-pdf';
import { loadSubmissionFormSchema } from '@/lib/forms/submission-files';
import { requireSession } from '@/lib/session';
import { buildOrgFormUrl } from '@/lib/tenant';

interface RouteContext {
  params: Promise<{ id: string; submissionId: string }>;
}

export async function GET(request: Request, { params }: RouteContext): Promise<NextResponse> {
  try {
    const session = await requireSession();
    const { id, submissionId } = await params;

    const result = await withOrgContext(session.user.organizationId, async (tx) => {
      const form = await tx.form.findFirst({
        where: { id, organizationId: session.user.organizationId },
      });
      // Same gate every sibling route on a submission uses (delete, status change,
      // upload presign/confirm) — this export route was the one missing it, so any
      // authenticated org member could download the full PDF (answers + attachments) for
      // a form marked isPrivate that they have no relationship to, just by knowing/
      // guessing its formId/submissionId pair.
      assertFormEditAccess(form, session.user.role, session.user.id);

      const submission = await tx.submission.findFirst({
        where: { id: submissionId, formId: form.id, organizationId: session.user.organizationId },
        select: { id: true, submittedAt: true, formVersionId: true, answers: true },
      });
      if (!submission) {
        return null;
      }

      const organization = await tx.organization.findUnique({
        where: { id: session.user.organizationId },
        select: { subdomain: true },
      });
      if (!organization) {
        return null;
      }

      // Resolved once against this submission's *own* form-version schema, not the
      // form's current one — so a filename prefix (or an uploaded-PDF attachment) still
      // resolves correctly for an old response even after the field it points at has
      // since been renamed, retyped, or removed from the live form.
      const schema = await loadSubmissionFormSchema(tx, submission, session.user.organizationId);
      const answers = (submission.answers ?? {}) as Record<string, unknown>;

      const pdfAttachments = await findUploadedPdfAttachments(
        tx,
        schema,
        answers,
        submission.id,
        session.user.organizationId,
      );
      const prefixValue = resolveFilenamePrefixValue(answers, form.filenamePrefixFieldId);

      return { form, submission, organization, pdfAttachments, prefixValue };
    });

    if (!result) {
      throw new NotFoundError('Submission');
    }

    const { form, submission, organization, pdfAttachments, prefixValue } = result;
    // NOT new URL(request.url).origin — behind Caddy (which terminates TLS and proxies
    // to the app container over plain HTTP) that resolves to the container's own bind
    // address, e.g. "https://0.0.0.0:3000", which Puppeteer then fails to load with
    // net::ERR_SSL_PROTOCOL_ERROR (HTTPS attempted against a plain-HTTP internal port
    // that was never reachable to begin with). The preview page is also only reachable
    // on the org's own subdomain in the first place (see src/middleware.ts) — building
    // that directly, the same way every other public-form link in this codebase does
    // (buildOrgFormUrl), sidesteps both problems at once.
    const previewUrl = buildOrgFormUrl(
      organization.subdomain,
      `/f/${form.slug}/submissions/${submission.id}/preview`,
    );
    const summaryPdfBuffer = await generateSubmissionPdfFromPreviewUrl(
      previewUrl,
      request.headers.get('cookie'),
    );
    const pdfBuffer = await appendUploadedPdfPages(summaryPdfBuffer, pdfAttachments);

    const filename = submissionPdfFilename(
      form.name,
      submission.submittedAt,
      form.pdfFilenameTemplate,
      (submission.answers ?? {}) as Record<string, unknown>,
      prefixValue,
    );

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
