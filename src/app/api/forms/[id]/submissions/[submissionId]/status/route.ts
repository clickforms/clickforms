import { NextResponse } from 'next/server';
import { z } from 'zod';
import { NotFoundError, toErrorResponse } from '@/lib/api-errors';
import { logAudit } from '@/lib/audit';
import { withOrgContext } from '@/lib/db';
import { assertFormEditAccess } from '@/lib/form-access';
import { requireOrganizationId, requireSession } from '@/lib/session';

interface RouteContext {
  params: Promise<{ id: string; submissionId: string }>;
}

// Manual review states a manager can move a response through from the Responses table —
// deliberately excludes 'in_progress' (that's only ever set by the respondent's own
// in-flight submission, never something staff toggle a response back into). 'approved'
// and 'rejected' are the two SubmissionStatus enum values that already existed but were
// never set anywhere in the app — this reuses them under the "Finalised"/"Rejected"
// labels (see SUBMISSION_STATUS_BADGE in submissions-list-client.tsx) rather than adding
// new enum values, since their meaning ("staff reviewed this response and it's done" /
// "staff reviewed this response and rejected it") already fits.
const REVIEW_STATUSES = ['submitted', 'approved', 'rejected'] as const;

const statusBodySchema = z.object({
  status: z.enum(REVIEW_STATUSES),
});

/**
 * Lets a manager mark a response Submitted/Finalised/Rejected from the Responses table —
 * same trust boundary as deleting a response (assertFormEditAccess), and freely
 * reversible between all three states (no one-way lock). Kept as its own route rather
 * than folded into the answers-only PATCH at .../[submissionId]/route.ts, which is
 * deliberately documented as never touching status.
 */
export async function PATCH(request: Request, { params }: RouteContext): Promise<NextResponse> {
  try {
    const session = await requireSession();
    const { id, submissionId } = await params;
    const body = statusBodySchema.parse(await request.json());

    const updated = await withOrgContext(session.user.organizationId, async (tx) => {
      const form = await tx.form.findFirst({
        where: { id, organizationId: requireOrganizationId(session) },
      });
      assertFormEditAccess(form, session.user.role, session.user.id);

      const submission = await tx.submission.findFirst({
        where: {
          id: submissionId,
          formId: form.id,
          organizationId: requireOrganizationId(session),
        },
        select: { id: true, status: true },
      });
      if (!submission) {
        throw new NotFoundError('Submission');
      }

      const result = await tx.submission.update({
        where: { id: submission.id },
        data: { status: body.status },
        select: { id: true, status: true },
      });

      await logAudit(
        {
          organizationId: requireOrganizationId(session),
          actorUserId: session.user.id,
          action: 'submission.status_update',
          entityType: 'submission',
          entityId: result.id,
          metadata: { formId: form.id, from: submission.status, to: result.status },
        },
        tx,
      );

      return result;
    });

    return NextResponse.json({ submissionId: updated.id, status: updated.status });
  } catch (error) {
    return toErrorResponse(error);
  }
}
