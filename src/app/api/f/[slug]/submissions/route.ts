import { NextResponse } from 'next/server';
import { toErrorResponse } from '@/lib/api-errors';
import { withOrgContext } from '@/lib/db';
import { getPublishedFormBySlug, getRequestIp } from '@/lib/forms/public-lookup';
import { resolveOrganizationIdOrThrow } from '@/lib/tenant';

interface RouteContext {
  params: Promise<{ slug: string }>;
}

// specs/03-form-renderer.md: created as soon as a respondent starts filling in a
// published form, bound to whichever form_version is live *right now*. Spec 03's
// acceptance criteria requires that binding to survive a later republish, so every
// subsequent route (uploads, final PATCH) reads submission.formVersionId rather than
// re-resolving form.currentVersionId.
export async function POST(request: Request, { params }: RouteContext): Promise<NextResponse> {
  try {
    const { slug } = await params;
    const organizationId = await resolveOrganizationIdOrThrow();
    const form = await getPublishedFormBySlug(slug, organizationId);

    const submission = await withOrgContext(form.organizationId, (tx) =>
      tx.submission.create({
        data: {
          organizationId: form.organizationId,
          formId: form.id,
          formVersionId: form.currentVersionId,
          status: 'in_progress',
          answers: {},
          ipAddress: getRequestIp(request),
        },
      }),
    );

    return NextResponse.json(
      { submissionId: submission.id, formVersionId: submission.formVersionId },
      { status: 201 },
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}
