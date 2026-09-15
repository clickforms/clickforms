import { NextResponse } from 'next/server';
import { InvalidRequestError, toErrorResponse } from '@/lib/api-errors';
import { logAudit } from '@/lib/audit';
import { prisma, withOrgContext } from '@/lib/db';
import { ForbiddenError, requireSession } from '@/lib/session';

/**
 * Reverse of POST /api/admin/organizations/[id]/join — lets a Clickforms platform admin
 * leave an organisation they temporarily joined for testing/investigation. Deliberately
 * scoped to only undo an actual "Join this organisation" action (an active, leftAt: null
 * PlatformAdminOrgAccess row must exist) rather than a generic "remove me from my org" —
 * a genuine org employee who also happens to be a platform admin should not be able to
 * detach themselves from their own organisation through this endpoint.
 */
export async function POST(): Promise<NextResponse> {
  try {
    const session = await requireSession();
    const organizationId = session.user.organizationId;

    if (!organizationId) {
      throw new InvalidRequestError('You are not currently a member of an organisation.');
    }

    // platform_admin_org_access carries no RLS — always readable via the plain client.
    const activeAccess = await prisma.platformAdminOrgAccess.findFirst({
      where: { userId: session.user.id, organizationId, leftAt: null },
      select: { id: true },
    });
    if (!activeAccess) {
      throw new ForbiddenError(
        'You can only leave an organisation you joined temporarily as Clickforms staff.',
      );
    }

    await withOrgContext(organizationId, async (tx) => {
      await tx.user.update({
        where: { id: session.user.id },
        data: { organizationId: null },
      });

      await tx.platformAdminOrgAccess.update({
        where: { id: activeAccess.id },
        data: { leftAt: new Date() },
      });

      await logAudit(
        {
          organizationId,
          actorUserId: session.user.id,
          action: 'platform_admin.left_organization',
          entityType: 'organization',
          entityId: organizationId,
          metadata: { email: session.user.email },
        },
        tx,
      );
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return toErrorResponse(error);
  }
}
