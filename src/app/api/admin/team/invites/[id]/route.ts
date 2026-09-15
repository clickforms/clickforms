import { NextResponse } from 'next/server';
import { NotFoundError, toErrorResponse } from '@/lib/api-errors';
import { prisma } from '@/lib/db';
import { sendEmail } from '@/lib/email';
import { platformAdminInviteEmail } from '@/lib/emails/templates';
import { requirePlatformAdmin, requireSession } from '@/lib/session';
import { platformAdminInviteAcceptUrl } from '@/lib/users/invite-url';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/** Refreshes a pending Team invite's expiry and re-sends the invite email — mirrors
 * GET /api/admin/organizations/[id]/invites/[inviteId]. */
export async function GET(_request: Request, { params }: RouteContext): Promise<NextResponse> {
  try {
    const session = await requireSession();
    requirePlatformAdmin(session);
    const { id } = await params;

    const existing = await prisma.platformAdminInvite.findFirst({
      where: { id, acceptedAt: null },
    });
    if (!existing) throw new NotFoundError('Invite');

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const invite = await prisma.platformAdminInvite.update({ where: { id }, data: { expiresAt } });

    const inviteUrl = platformAdminInviteAcceptUrl(invite.token);
    const rendered = platformAdminInviteEmail({
      name: invite.name ?? invite.email,
      role: invite.role,
      invitedByName: session.user.name ?? 'The Clickforms team',
      inviteUrl,
    });

    await sendEmail({
      to: invite.email,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      kind: 'platform_admin_invite',
    });

    return NextResponse.json({
      inviteUrl,
      expiresAt: invite.expiresAt.toISOString(),
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}

/** Revokes a pending Team invite. */
export async function DELETE(_request: Request, { params }: RouteContext): Promise<NextResponse> {
  try {
    const session = await requireSession();
    requirePlatformAdmin(session);
    const { id } = await params;

    const existing = await prisma.platformAdminInvite.findFirst({
      where: { id, acceptedAt: null },
    });
    if (!existing) throw new NotFoundError('Invite');

    await prisma.platformAdminInvite.delete({ where: { id } });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return toErrorResponse(error);
  }
}
