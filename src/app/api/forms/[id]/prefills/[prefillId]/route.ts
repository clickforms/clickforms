import { NextResponse } from 'next/server';
import { InvalidRequestError, NotFoundError, toErrorResponse } from '@/lib/api-errors';
import { logAudit } from '@/lib/audit';
import { withOrgContext } from '@/lib/db';
import { assertFormEditAccess } from '@/lib/form-access';
import { requireOrganizationId, requireRole, requireSession } from '@/lib/session';

interface RouteContext {
  params: Promise<{ id: string; prefillId: string }>;
}

/** Deletes a prefill (its link stops working). Responses that came back through it are kept —
 * submissions.prefill_id is nulled by the foreign key, and prefill_recipient preserves the
 * "sent to" label on each response. */
export async function DELETE(_request: Request, { params }: RouteContext): Promise<NextResponse> {
  try {
    const session = await requireSession();
    requireRole(session, ['admin', 'editor', 'member']);
    const { id, prefillId } = await params;
    const organizationId = requireOrganizationId(session);

    await withOrgContext(organizationId, async (tx) => {
      const form = await tx.form.findFirst({ where: { id, organizationId } });
      assertFormEditAccess(form, session.user.role, session.user.id);

      const held = await tx.$queryRaw<{ n: number }[]>`
        SELECT count(*)::int AS n FROM submissions
        WHERE prefill_id = ${prefillId}::uuid AND prefill_held`;
      if ((held[0]?.n ?? 0) > 0) {
        throw new InvalidRequestError(
          'This prefill has a returned response waiting for review. Promote or discard it first.',
        );
      }

      const deleted = await tx.$executeRaw`
        DELETE FROM form_prefills WHERE id = ${prefillId}::uuid AND form_id = ${form.id}::uuid`;
      if (deleted === 0) throw new NotFoundError('Prefill');
      await logAudit(
        {
          organizationId,
          actorUserId: session.user.id,
          action: 'prefill.delete',
          entityType: 'prefill',
          entityId: prefillId,
          metadata: { formId: form.id },
        },
        tx,
      );
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return toErrorResponse(error);
  }
}
