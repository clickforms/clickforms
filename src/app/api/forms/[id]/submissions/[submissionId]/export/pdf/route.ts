import { NextResponse } from 'next/server';
import { NotFoundError, toErrorResponse } from '@/lib/api-errors';
import { withOrgContext } from '@/lib/db';
import {
  generateSubmissionPdfFromPreviewUrl,
  submissionPdfFilename,
} from '@/lib/forms/generate-submission-pdf';
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
        select: { id: true, name: true, slug: true },
      });
      if (!form) {
        return null;
      }

      const submission = await tx.submission.findFirst({
        where: { id: submissionId, formId: form.id, organizationId: session.user.organizationId },
        select: { id: true, submittedAt: true },
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

      return { form, submission, organization };
    });

    if (!result) {
      throw new NotFoundError('Submission');
    }

    const { form, submission, organization } = result;
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
    const pdfBuffer = await generateSubmissionPdfFromPreviewUrl(
      previewUrl,
      request.headers.get('cookie'),
    );

    const filename = submissionPdfFilename(form.name, submission.submittedAt);

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
