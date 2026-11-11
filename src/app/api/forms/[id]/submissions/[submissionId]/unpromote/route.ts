import { NextResponse } from 'next/server';
import { InvalidRequestError, NotFoundError, toErrorResponse } from '@/lib/api-errors';
import { logAudit } from '@/lib/audit';
import { withOrgContext } from '@/lib/db';
import { assertFormEditAccess } from '@/lib/form-access';
import { UNPROMOTE_WINDOW_MS } from '@/lib/forms/prefill-unpromote';
import { requireOrganizationId, requireRole, requireSession } from '@/lib/session';

interface RouteContext {
  params: Promise<{ id: string; submissionId: string }>;
}

/**
 * Moves a response that was promoted from a prefill back to the Prefills tab (held for review
 * again), for a limited time after it was promoted. Promotion stays final once the window
 * (UNPROMOTE_WINDOW_MS) has passed. The promote time comes from the audit log.
 */
export async function POST(_request: Request, { params }: RouteContext): Promise<NextResponse> {
  try {
    const session = await requireSession();
    requireRole(session, ['admin', 'editor', 'member']);
    const { id, submissionId } = await params;
    const organizationId = requireOrganizationId(session);

    await withOrgContext(organizationId, async (tx) => {
      const form = await tx.form.findFirst({ where: { id, organizationId } });
      assertFormEditAccess(form, session.user.role, session.user.id);

      const rows = await tx.$queryRaw<
        { prefill_id: string | null; prefill_held: boolean; status: string }[]
      >`SELECT prefill_id, prefill_held, status FROM submissions
        WHERE id = ${submissionId}::uuid AND form_id = ${form.id}::uuid`;
      const submission = rows[0];
      if (!submission) throw new NotFoundError('Submission');
      if (!submission.prefill_id || submission.prefill_held) {
        throw new InvalidRequestError('This response was not promoted from a prefill.');
      }
      if (submission.status !== 'submitted') {
        throw new InvalidRequestError(
          'Only a response that is still in the Submitted status can be moved back to Prefills.',
        );
      }

      const promoted = await tx.auditLog.findFirst({
        where: {
          organizationId,
          entityType: 'submission',
          entityId: submissionId,
          action: 'submission.promote',
        },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      });
      if (!promoted || Date.now() - promoted.createdAt.getTime() > UNPROMOTE_WINDOW_MS) {
        throw new InvalidRequestError(
          'This response was promoted too long ago to move back to Prefills.',
        );
      }

      await tx.$executeRaw`
        UPDATE submissions SET status = 'in_progress', prefill_held = true
        WHERE id = ${submissionId}::uuid`;

      await logAudit(
        {
          organizationId,
          actorUserId: session.user.id,
          action: 'submission.unpromote',
          entityType: 'submission',
          entityId: submissionId,
          metadata: { formId: form.id, prefillId: submission.prefill_id },
        },
        tx,
      );
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return toErrorResponse(error);
  }
}
