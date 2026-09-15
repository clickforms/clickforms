import { NextResponse } from 'next/server';
import { NotFoundError, toErrorResponse } from '@/lib/api-errors';
import { logAudit } from '@/lib/audit';
import { withOrgContext } from '@/lib/db';
import { sendEmail } from '@/lib/email';
import { inviteEmail } from '@/lib/emails/templates';
import { requireRole, requireSession } from '@/lib/session';
import { inviteAcceptUrl } from '@/lib/users/invite-url';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/** Refreshes a pending invite's expiry window and re-sends the invite email — the "Resend
 * invite" action on the org Users page. Used to previously only refresh the token/expiry
 * and hand back a URL for the admin to copy/share manually; now it actually re-sends,
 * same template and sendEmail() path as the original invite (src/app/api/users/route.ts). */
export async function GET(_request: Request, { params }: RouteContext): Promise<NextResponse> {
  try {
    const session = await requireSession();
    requireRole(session, ['admin']);
    const { id } = await params;

    const result = await withOrgContext(session.user.organizationId, async (tx) => {
      const existing = await tx.userInvite.findFirst({
        where: {
          id,
          organizationId: session.user.organizationId,
          acceptedAt: null,
        },
      });
      if (!existing) throw new NotFoundError('Invite');

      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const [invite, organization, invitedBy] = await Promise.all([
        tx.userInvite.update({ where: { id: existing.id }, data: { expiresAt } }),
        tx.organization.findUnique({
          where: { id: session.user.organizationId },
          select: { name: true },
        }),
        tx.user.findUnique({
          where: { id: session.user.id },
          select: { name: true, email: true },
        }),
      ]);

      return {
        invite,
        organizationName: organization?.name ?? 'Clickforms',
        invitedByName: invitedBy?.name ?? invitedBy?.email ?? 'A teammate',
      };
    });

    const inviteUrl = inviteAcceptUrl(result.invite.token);
    const rendered = inviteEmail({
      name: result.invite.name ?? result.invite.email,
      organizationName: result.organizationName,
      role: result.invite.role,
      invitedByName: result.invitedByName,
      inviteUrl,
    });

    await sendEmail({
      to: result.invite.email,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      kind: 'invite',
      organizationId: session.user.organizationId,
    });

    return NextResponse.json({
      inviteUrl,
      expiresAt: result.invite.expiresAt.toISOString(),
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
