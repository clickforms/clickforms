import { NextResponse } from 'next/server';
import { toErrorResponse } from '@/lib/api-errors';
import { logAudit } from '@/lib/audit';
import { withOrgContext } from '@/lib/db';
import { assertFormEditAccess } from '@/lib/form-access';
import { requireOrganizationId, requireRole, requireSession } from '@/lib/session';

interface RouteContext {
  params: Promise<{ id: string; prefillId: string }>;
}

/** Discards the held (not yet promoted) response under a prefill. The link becomes usable again. */
export async function POST(_request: Request, { params }: RouteContext): Promise<NextResponse> {
  try {
    const session = await requireSession();
    requireRole(session, ['admin', 'editor', 'member']);
    const { id, prefillId } = await params;
    const organizationId = requireOrganizationId(session);

    await withOrgContext(organizationId, async (tx) => {
      const form = await tx.form.findFirst({ where: { id, organizationId } });
      assertFormEditAccess(form, session.user.role, session.user.id);

      const held = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM submissions
        WHERE prefill_id = ${prefillId}::uuid AND form_id = ${form.id}::uuid AND prefill_held`;
      for (const row of held) {
        await tx.submission.delete({ where: { id: row.id } });
        await logAudit(
          {
            organizationId,
            actorUserId: session.user.id,
            action: 'submission.delete',
            entityType: 'submission',
            entityId: row.id,
            metadata: { formId: form.id, prefillId, reason: 'discarded_prefill_response' },
          },
          tx,
        );
      }
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return toErrorResponse(error);
  }
}
