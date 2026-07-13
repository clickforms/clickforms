import { NextResponse } from 'next/server';
import { NotFoundError, toErrorResponse } from '@/lib/api-errors';
import { logAudit } from '@/lib/audit';
import { withOrgContext } from '@/lib/db';
import { requireRole, requireSession } from '@/lib/session';
import { inviteAcceptUrl } from '@/lib/users/invite-url';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/** Returns a copyable invite link for a pending invite. Refreshes the expiry window. */
export async function GET(_request: Request, { params }: RouteContext): Promise<NextResponse> {
  try {
    const session = await requireSession();
    requireRole(session, ['admin']);
    const { id } = await params;

    const invite = await withOrgContext(session.user.organizationId, async (tx) => {
      const existing = await tx.userInvite.findFirst({
        where: {
          id,
          organizationId: session.user.organizationId,
          acceptedAt: null,
        },
      });
      if (!existing) throw new NotFoundError('Invite');

      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      return tx.userInvite.update({
        where: { id: existing.id },
        data: { expiresAt },
      });
    });

    return NextResponse.json({
      inviteUrl: inviteAcceptUrl(invite.token),
      expiresAt: invite.expiresAt.toISOString(),
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}

/** Revokes a pending invite so the link can no longer be used. */
export async function DELETE(_request: Request, { params }: RouteContext): Promise<NextResponse> {
  try {
    const session = await requireSession();
    requireRole(session, ['admin']);
    const { id } = await params;

    await withOrgContext(session.user.organizationId, async (tx) => {
      const existing = await tx.userInvite.findFirst({
        where: {
          id,
          organizationId: session.user.organizationId,
          acceptedAt: null,
        },
      });
      if (!existing) throw new NotFoundError('Invite');

      await tx.userInvite.delete({ where: { id: existing.id } });

      await logAudit(
        {
          organizationId: session.user.organizationId,
          actorUserId: session.user.id,
          action: 'user.invite_revoke',
          entityType: 'user_invite',
          entityId: existing.id,
          metadata: { email: existing.email },
        },
        tx,
      );
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return toErrorResponse(error);
  }
}
