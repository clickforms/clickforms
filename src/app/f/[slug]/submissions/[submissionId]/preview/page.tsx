import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { SubmissionFormExportDocument } from '@/components/submission-export/submission-form-export-document';
import { authOptions } from '@/lib/auth';
import { prisma, withOrgContext } from '@/lib/db';
import { buildSubmissionExportAssets } from '@/lib/forms/build-submission-export-assets';
import type { FormAnswers } from '@/lib/forms/conditional-logic';
import { verifyInternalPreviewToken } from '@/lib/forms/internal-preview-token';
import { createEmptyFormSchema, type FormSchema, formSchemaSchema } from '@/lib/forms/schema';
import {
  SUBMISSION_EXPORT_PDF_OVERRIDE_STYLES,
  SUBMISSION_EXPORT_STYLES,
} from '@/lib/forms/submission-export-styles';
import {
  buildSubmissionFileMaps,
  createDownloadUrlMap,
  createSubmissionFileResolver,
  parseSubmissionAnswers,
} from '@/lib/forms/submission-files';

interface PageProps {
  params: Promise<{ slug: string; submissionId: string }>;
  searchParams: Promise<{ print?: string; internalToken?: string }>;
}

/** Admin-only preview of a submitted response — same visual layout as the PDF export,
 *  filled with the respondent's answers against the form version the submission used. */
export default async function SubmissionPreviewPage({ params, searchParams }: PageProps) {
  const { slug, submissionId } = await params;
  const { print, internalToken } = await searchParams;

  // Set by generate-submission-pdf.ts when Puppeteer requests this page — lets
  // us skip the admin-only banner server-side instead of stripping it from the
  // DOM client-side after load, which raced with React hydration and threw a
  // hydration-mismatch error in the (headless) browser console. `?print=1` is the
  // same signal for the Responses table's preview modal (submission-preview-modal.tsx),
  // which embeds this page in an iframe and can't set custom request headers.
  const requestHeaders = await headers();
  const isPdfExport = requestHeaders.get('x-forms-pdf-export') === '1' || print === '1';

  // Two ways in: a real admin session (the manual "Download PDF" export, which forwards
  // the admin's own cookie to Puppeteer), or a scoped internalToken (the submission-
  // notification email's PDF attachment, fired from the unauthenticated public submit
  // route with no session to forward) — see internal-preview-token.ts. The token is
  // checked against this exact submissionId, so it can never be reused for any other
  // response even if somehow observed.
  const session = await getServerSession(authOptions);
  const hasValidInternalToken =
    typeof internalToken === 'string' && verifyInternalPreviewToken(submissionId, internalToken);

  if (!session?.user && !hasValidInternalToken) {
    notFound();
  }

  let organizationId: string;
  if (session?.user) {
    organizationId = session.user.organizationId;
  } else {
    // No session to scope by — resolve organizationId from the submission itself, same
    // deliberate pre-auth exception documented in lib/forms/public-lookup.ts.
    const submissionLookup = await prisma.submission.findUnique({
      where: { id: submissionId },
      select: { organizationId: true },
    });
    if (!submissionLookup) notFound();
    organizationId = submissionLookup.organizationId;
  }

  const result = await withOrgContext(organizationId, async (tx) => {
    const form = await tx.form.findFirst({
      where: { slug, organizationId },
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
    notFound();
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

  const submittedLabel = submission.submittedAt
    ? new Date(submission.submittedAt).toLocaleString('en-AU')
    : 'Not yet submitted';

  return (
    <div className="public-form-layout">
      <div className="form-preview-shell">
        {isPdfExport ? null : (
          <div className="form-preview-banner">
            Submission preview — submitted {submittedLabel}. This is a read-only view of the
            response.
          </div>
        )}
        <style>{SUBMISSION_EXPORT_STYLES}</style>
        {isPdfExport ? <style>{SUBMISSION_EXPORT_PDF_OVERRIDE_STYLES}</style> : null}
        <SubmissionFormExportDocument
          formName={form.name}
          schema={schema}
          answers={answers}
          assets={assets}
          resolveFiles={resolveFiles}
        />
      </div>
    </div>
  );
}
