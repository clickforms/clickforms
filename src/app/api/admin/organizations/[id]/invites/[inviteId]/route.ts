import { NextResponse } from 'next/server';
import { NotFoundError, toErrorResponse } from '@/lib/api-errors';
import { logAudit } from '@/lib/audit';
import { withOrgContext } from '@/lib/db';
import { sendEmail } from '@/lib/email';
import { inviteEmail } from '@/lib/emails/templates';
import { requirePlatformAdmin, requireSession } from '@/lib/session';
import { inviteAcceptUrl } from '@/lib/users/invite-url';

interface RouteContext {
  params: Promise<{ id: string; inviteId: string }>;
}

/** Refreshes a pending invite's expiry and re-sends the invite email — admin-scoped
 * equivalent of GET /api/users/invites/[id], reachable for any organisation. */
export async function GET(_request: Request, { params }: RouteContext): Promise<NextResponse> {
  try {
    const session = await requireSession();
    requirePlatformAdmin(session);
    const { id, inviteId } = await params;

    const result = await withOrgContext(id, async (tx) => {
      const existing = await tx.userInvite.findFirst({
        where: { id: inviteId, organizationId: id, acceptedAt: null },
      });
      if (!existing) throw new NotFoundError('Invite');

      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const [invite, organization] = await Promise.all([
        tx.userInvite.update({ where: { id: existing.id }, data: { expiresAt } }),
        tx.organization.findUnique({ where: { id }, select: { name: true } }),
      ]);

      return { invite, organizationName: organization?.name ?? 'Clickforms' };
    });

    const inviteUrl = inviteAcceptUrl(result.invite.token);
    const rendered = inviteEmail({
      name: result.invite.name ?? result.invite.email,
      organizationName: result.organizationName,
      role: result.invite.role,
      invitedByName: 'The Clickforms team',
      inviteUrl,
    });

    await sendEmail({
      to: result.invite.email,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      kind: 'invite',
      organizationId: id,
    });

    return NextResponse.json({
      inviteUrl,
      expiresAt: result.invite.expiresAt.toISOString(),
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}

/** Revokes a pending invite. Admin-scoped equivalent of DELETE /api/users/invites/[id]. */
export async function DELETE(_request: Request, { params }: RouteContext): Promise<NextResponse> {
  try {
    const session = await requireSession();
    requirePlatformAdmin(session);
    const { id, inviteId } = await params;

    await withOrgContext(id, async (tx) => {
      const existing = await tx.userInvite.findFirst({
        where: { id: inviteId, organizationId: id, acceptedAt: null },
      });
      if (!existing) throw new NotFoundError('Invite');

      await tx.userInvite.delete({ where: { id: existing.id } });

      await logAudit(
        {
          organizationId: id,
          actorUserId: session.user.id,
          action: 'admin.user_invite_revoke',
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
