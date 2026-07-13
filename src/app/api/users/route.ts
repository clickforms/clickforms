import { NextResponse } from 'next/server';
import { z } from 'zod';
import { InvalidRequestError, toErrorResponse } from '@/lib/api-errors';
import { logAudit } from '@/lib/audit';
import { withOrgContext } from '@/lib/db';
import { sendEmail } from '@/lib/email';
import { inviteEmail } from '@/lib/emails/templates';
import { requireRole, requireSession } from '@/lib/session';
import { INVITABLE_ROLES } from '@/lib/user-roles';
import { inviteAcceptUrl } from '@/lib/users/invite-url';

const inviteUserBodySchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200),
  email: z.string().trim().email('Enter a valid email'),
  role: z.enum(INVITABLE_ROLES),
});

/** Lists users and pending invites for the current organisation. */
export async function GET(): Promise<NextResponse> {
  try {
    const session = await requireSession();
    requireRole(session, ['admin']);

    const result = await withOrgContext(session.user.organizationId, async (tx) => {
      const [users, pendingInvites, formCounts] = await Promise.all([
        tx.user.findMany({
          where: { organizationId: session.user.organizationId },
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            createdAt: true,
          },
        }),
        tx.userInvite.findMany({
          where: {
            organizationId: session.user.organizationId,
            acceptedAt: null,
            expiresAt: { gt: new Date() },
          },
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            expiresAt: true,
            createdAt: true,
          },
        }),
        tx.form.groupBy({
          by: ['createdBy'],
          where: { organizationId: session.user.organizationId },
          _count: { _all: true },
        }),
      ]);

      const formsOwnedByUserId = new Map(formCounts.map((row) => [row.createdBy, row._count._all]));

      return {
        users: users.map((user) => ({
          ...user,
          createdAt: user.createdAt.toISOString(),
          formsOwned: formsOwnedByUserId.get(user.id) ?? 0,
          assignedForms: 0,
        })),
        pendingInvites: pendingInvites.map((invite) => ({
          ...invite,
          createdAt: invite.createdAt.toISOString(),
          expiresAt: invite.expiresAt.toISOString(),
        })),
      };
    });

    return NextResponse.json(result);
  } catch (error) {
    return toErrorResponse(error);
  }
}

/** Creates a pending invite for a new org member (admin shares the link manually). */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const session = await requireSession();
    requireRole(session, ['admin']);

    const body = inviteUserBodySchema.parse(await request.json());
    const email = body.email.toLowerCase();

    const result = await withOrgContext(session.user.organizationId, async (tx) => {
      const existingUser = await tx.user.findFirst({
        where: { organizationId: session.user.organizationId, email },
      });
      if (existingUser) {
        throw new InvalidRequestError(
          'A user with this email already exists in your organisation.',
        );
      }

      const token = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      const invite = await tx.userInvite.upsert({
        where: {
          organizationId_email: {
            organizationId: session.user.organizationId,
            email,
          },
        },
        create: {
          organizationId: session.user.organizationId,
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
          organizationId: session.user.organizationId,
          actorUserId: session.user.id,
          action: 'user.invite',
          entityType: 'user_invite',
          entityId: invite.id,
          metadata: { email, role: body.role },
        },
        tx,
      );

      // Fetched inside the same org-scoped transaction: the org's display name and the
      // inviting admin's name aren't on the JWT session, so this is the cheapest place
      // to grab them for the invite email.
      const [organization, invitedBy] = await Promise.all([
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
    });

    return NextResponse.json(
      {
        inviteId: result.invite.id,
        inviteUrl,
        expiresAt: result.invite.expiresAt.toISOString(),
      },
      { status: 201 },
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}
