import { NextResponse } from 'next/server';
import { assertOrgActionsAllowed } from '@/lib/admin/plan-enforcement';
import { toErrorResponse } from '@/lib/api-errors';
import { logAudit } from '@/lib/audit';
import { withOrgContext } from '@/lib/db';
import { parsePreheader, preheaderSchema } from '@/lib/org-preheader';
import { requireOrganizationId, requireRole, requireSession } from '@/lib/session';

/** Saves the organisation pre-header. Admins only. */
export async function PUT(request: Request): Promise<NextResponse> {
  try {
    const session = await requireSession();
    requireRole(session, ['admin']);
    const body = preheaderSchema.parse(await request.json());
    const orgId = requireOrganizationId(session);

    await withOrgContext(session.user.organizationId, async (tx) => {
      await assertOrgActionsAllowed(tx, orgId);
      await tx.organization.update({ where: { id: orgId }, data: { preheader: body } });
      await logAudit(
        {
          organizationId: orgId,
          actorUserId: session.user.id,
          action: 'organization.details_update',
          entityType: 'organization',
          entityId: orgId,
          metadata: { preheader: true },
        },
        tx,
      );
    });

    return NextResponse.json({ preheader: parsePreheader(body) });
  } catch (error) {
    return toErrorResponse(error);
  }
}
