import { NextResponse } from 'next/server';
import { z } from 'zod';
import { InvalidRequestError, NotFoundError, toErrorResponse } from '@/lib/api-errors';
import { logAudit } from '@/lib/audit';
import { withOrgContext } from '@/lib/db';
import { sendEmail } from '@/lib/email';
import { inviteEmail } from '@/lib/emails/templates';
import { requirePlatformAdmin, requireSession } from '@/lib/session';
import { INVITABLE_ROLES } from '@/lib/user-roles';
import { inviteAcceptUrl } from '@/lib/users/invite-url';

interface RouteContext {
  params: Promise<{ id: string }>;
}

const inviteBodySchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200),
  email: z.string().trim().email('Enter a valid email'),
  role: z.enum(INVITABLE_ROLES).default('admin'),
});

/**
 * Invites another user into an existing organisation on a platform admin's behalf — the
 * same underlying UserInvite row an org's own admin would create via POST /api/users,
 * just reachable for an org this admin isn't a member of. Used both to add a second
 * admin to an org and to re-send an onboarding invite whose link expired.
 */
export async function POST(request: Request, { params }: RouteContext): Promise<NextResponse> {
  try {
    const session = await requireSession();
    requirePlatformAdmin(session);
    const { id } = await params;
    const body = inviteBodySchema.parse(await request.json());
    const email = body.email.toLowerCase();

    const result = await withOrgContext(id, async (tx) => {
      const organization = await tx.organization.findUnique({
        where: { id },
        select: { name: true },
      });
      if (!organization) throw new NotFoundError('Organization');

      const existingUser = await tx.user.findFirst({ where: { organizationId: id, email } });
      if (existingUser) {
        throw new InvalidRequestError(
          'A user with this email already exists in this organisation.',
        );
      }

      const token = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      const invite = await tx.userInvite.upsert({
        where: { organizationId_email: { organizationId: id, email } },
        create: {
          organizationId: id,
          email,
          name: body.name.trim(),
          role: body.role,
          token,
          invitedById: session.user.id,
          expiresAt,
        },
        update: {
          name: body.name.trim(),
          role: body.role,
          token,
          invitedById: session.user.id,
          expiresAt,
          acceptedAt: null,
        },
      });

      await logAudit(
        {
          organizationId: id,
          actorUserId: session.user.id,
          action: 'admin.user_invite',
          entityType: 'user_invite',
          entityId: invite.id,
          metadata: { email, role: body.role },
        },
        tx,
      );

      return { invite, organizationName: organization.name };
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

    return NextResponse.json(
      { inviteId: result.invite.id, inviteUrl, expiresAt: result.invite.expiresAt.toISOString() },
      { status: 201 },
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}
