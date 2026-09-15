import { NextResponse } from 'next/server';
import { z } from 'zod';
import { PLATFORM_ADMIN_ROLES } from '@/lib/admin/platform-admin-roles';
import { toErrorResponse } from '@/lib/api-errors';
import { prisma } from '@/lib/db';
import { sendEmail } from '@/lib/email';
import { platformAdminInviteEmail } from '@/lib/emails/templates';
import { requirePlatformAdmin, requireSession } from '@/lib/session';
import { platformAdminInviteAcceptUrl } from '@/lib/users/invite-url';

const inviteTeamMemberBodySchema = z.object({
  email: z.string().trim().email('Enter a valid email'),
  name: z.string().trim().min(1, 'Name is required').max(200),
  role: z.enum(PLATFORM_ADMIN_ROLES),
});

/**
 * Lists current platform admins plus any pending /admin "Team" invites. Deliberately a
 * plain `prisma` query, not `withOrgContext` — platform admins have organizationId:
 * null, so there is no org to scope by (same exception as the rest of /admin).
 */
export async function GET(): Promise<NextResponse> {
  try {
    const session = await requireSession();
    requirePlatformAdmin(session);

    const [admins, pendingInvites] = await Promise.all([
      prisma.user.findMany({
        where: { isPlatformAdmin: true },
        orderBy: { createdAt: 'asc' },
        select: { id: true, name: true, email: true, platformAdminRole: true, createdAt: true },
      }),
      prisma.platformAdminInvite.findMany({
        where: { acceptedAt: null, expiresAt: { gt: new Date() } },
        orderBy: { createdAt: 'desc' },
        select: { id: true, email: true, name: true, role: true, expiresAt: true, createdAt: true },
      }),
    ]);

    return NextResponse.json({
      admins: admins.map((admin) => ({ ...admin, createdAt: admin.createdAt.toISOString() })),
      pendingInvites: pendingInvites.map((invite) => ({
        ...invite,
        createdAt: invite.createdAt.toISOString(),
        expiresAt: invite.expiresAt.toISOString(),
      })),
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}

/** Invites a new platform admin. No audit log entry — AuditLog.organizationId is
 * required and a platform-staff invite has no organisation to attribute it to. */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const session = await requireSession();
    requirePlatformAdmin(session);

    const body = inviteTeamMemberBodySchema.parse(await request.json());
    const email = body.email.toLowerCase();

    const existingUser = await prisma.user.findFirst({ where: { email, isPlatformAdmin: true } });
    if (existingUser) {
      return NextResponse.json(
        { error: 'A platform admin with this email already exists.' },
        { status: 400 },
      );
    }

    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const invite = await prisma.platformAdminInvite.upsert({
      where: { email },
      create: {
        email,
        name: body.name,
        role: body.role,
        token,
        invitedById: session.user.id,
        expiresAt,
      },
      update: {
        name: body.name,
        role: body.role,
        token,
        invitedById: session.user.id,
        expiresAt,
        acceptedAt: null,
      },
    });

    const inviteUrl = platformAdminInviteAcceptUrl(invite.token);
    const rendered = platformAdminInviteEmail({
      name: body.name,
      role: body.role,
      invitedByName: session.user.name ?? 'The Clickforms team',
      inviteUrl,
    });

    await sendEmail({
      to: email,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      kind: 'platform_admin_invite',
    });

    return NextResponse.json(
      { inviteId: invite.id, inviteUrl, expiresAt: invite.expiresAt.toISOString() },
      { status: 201 },
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}
