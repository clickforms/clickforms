import { NextResponse } from 'next/server';
import { InvalidRequestError, toErrorResponse } from '@/lib/api-errors';
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

    // Optional: the respondent arrived through an emailed prefill link. Body may be empty.
    const body: { prefillToken?: unknown } = await request.json().catch(() => ({}));
    const prefillToken =
      typeof body.prefillToken === 'string' && body.prefillToken.length <= 100
        ? body.prefillToken
        : null;

    const submission = await withOrgContext(form.organizationId, async (tx) => {
      if (prefillToken) {
        const used = await tx.$queryRaw<{ used: boolean }[]>`
          SELECT EXISTS (
            SELECT 1 FROM submissions s JOIN form_prefills p ON p.id = s.prefill_id
            WHERE p.token = ${prefillToken} AND p.form_id = ${form.id}::uuid
              AND s.created_at >= COALESCE(p.sent_at, p.created_at)
              AND (s.prefill_held OR s.status <> 'in_progress')) AS used`;
        if (used[0]?.used) {
          throw new InvalidRequestError('This link has already been used to submit the form.');
        }
      }
      const created = await tx.submission.create({
        data: {
          organizationId: form.organizationId,
          formId: form.id,
          formVersionId: form.currentVersionId,
          status: 'in_progress',
          answers: {},
          ipAddress: getRequestIp(request),
        },
      });
      if (prefillToken) {
        // Links the response to its prefill (and snapshots the recipient so the label
        // survives the prefill being deleted). An unknown/other-form token is just ignored.
        await tx.$executeRaw`
          UPDATE submissions SET prefill_id = p.id, prefill_recipient = COALESCE(p.recipient_email, p.recipient_name, 'Shared link')
          FROM form_prefills p
          WHERE submissions.id = ${created.id}::uuid
            AND p.token = ${prefillToken} AND p.form_id = ${form.id}::uuid AND NOT p.is_draft`;
      }
      return created;
    });

    return NextResponse.json(
      { submissionId: submission.id, formVersionId: submission.formVersionId },
      { status: 201 },
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}
