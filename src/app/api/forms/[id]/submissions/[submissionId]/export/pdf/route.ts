import { NextResponse } from 'next/server';
import { NotFoundError, toErrorResponse } from '@/lib/api-errors';
import { withOrgContext } from '@/lib/db';
import {
  generateSubmissionPdfFromPreviewUrl,
  submissionPdfFilename,
} from '@/lib/forms/generate-submission-pdf';
import { requireSession } from '@/lib/session';

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

      return { form, submission };
    });

    if (!result) {
      throw new NotFoundError('Submission');
    }

    const { form, submission } = result;
    const origin = new URL(request.url).origin;
    const previewUrl = `${origin}/f/${form.slug}/submissions/${submission.id}/preview`;
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
