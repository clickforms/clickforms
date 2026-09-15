import bcrypt from 'bcryptjs';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { InvalidRequestError, toErrorResponse } from '@/lib/api-errors';
import { prisma } from '@/lib/db';
import { passwordSchema } from '@/lib/users/password';

const acceptTeamInviteBodySchema = z.object({
  token: z.string().min(1),
  name: z.string().trim().min(1, 'Name is required').max(200),
  password: passwordSchema,
});

/**
 * Accepts a pending /admin "Team" invite and creates the platform-admin account.
 * Mirrors POST /api/invites/accept, but the resulting user has organizationId: null
 * (platform admins don't belong to a customer Organization — see prisma/schema.prisma
 * User.isPlatformAdmin doc comment) so this runs on the plain `prisma` client rather
 * than withOrgContext, same as every other org-less lookup in this app.
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const { token, name, password } = acceptTeamInviteBodySchema.parse(await request.json());

    const invite = await prisma.platformAdminInvite.findUnique({ where: { token } });
    if (!invite || invite.acceptedAt || invite.expiresAt < new Date()) {
      throw new InvalidRequestError('This invite link is invalid or has expired.');
    }

    const existingUser = await prisma.user.findFirst({
      where: { email: invite.email, isPlatformAdmin: true },
    });
    if (existingUser) {
      throw new InvalidRequestError('A platform admin with this email already exists.');
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          organizationId: null,
          email: invite.email,
          name: name.trim(),
          passwordHash,
          role: 'member',
          isPlatformAdmin: true,
          platformAdminRole: invite.role,
        },
      });

      await tx.platformAdminInvite.update({
        where: { id: invite.id },
        data: { acceptedAt: new Date() },
      });

      return created;
    });

    return NextResponse.json({ userId: user.id, email: user.email }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
