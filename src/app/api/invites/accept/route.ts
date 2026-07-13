import bcrypt from 'bcryptjs';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { InvalidRequestError, toErrorResponse } from '@/lib/api-errors';
import { logAudit } from '@/lib/audit';
import { prisma, withOrgContext } from '@/lib/db';

const acceptInviteBodySchema = z.object({
  token: z.string().min(1),
  name: z.string().trim().min(1, 'Name is required').max(200),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

/** Accepts a pending invite and creates the user account. */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const { token, name, password } = acceptInviteBodySchema.parse(await request.json());

    const invite = await prisma.userInvite.findUnique({ where: { token } });
    if (!invite || invite.acceptedAt || invite.expiresAt < new Date()) {
      throw new InvalidRequestError('This invite link is invalid or has expired.');
    }

    const existingUser = await prisma.user.findFirst({
      where: { organizationId: invite.organizationId, email: invite.email },
    });
    if (existingUser) {
      throw new InvalidRequestError(
        'An account with this email already exists in this organisation.',
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await withOrgContext(invite.organizationId, async (tx) => {
      const created = await tx.user.create({
        data: {
          organizationId: invite.organizationId,
          email: invite.email,
          name: name.trim(),
          passwordHash,
          role: invite.role,
        },
      });

      await tx.userInvite.update({
        where: { id: invite.id },
        data: { acceptedAt: new Date() },
      });

      await logAudit(
        {
          organizationId: invite.organizationId,
          actorUserId: created.id,
          action: 'user.invite_accept',
          entityType: 'user',
          entityId: created.id,
          metadata: { inviteId: invite.id, role: invite.role },
        },
        tx,
      );

      return created;
    });

    return NextResponse.json({ userId: user.id, email: user.email }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
