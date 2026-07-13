import bcrypt from 'bcryptjs';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { InvalidRequestError, toErrorResponse } from '@/lib/api-errors';
import { logAudit } from '@/lib/audit';
import { prisma, withOrgContext } from '@/lib/db';

const resetPasswordBodySchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

/** Consumes a password-reset token and sets the user's new password. */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const { token, password } = resetPasswordBodySchema.parse(await request.json());

    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date()) {
      throw new InvalidRequestError('This password reset link is invalid or has expired.');
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const { user } = resetToken;

    await withOrgContext(user.organizationId, async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: { passwordHash },
      });

      await tx.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { usedAt: new Date() },
      });

      await logAudit(
        {
          organizationId: user.organizationId,
          actorUserId: user.id,
          action: 'user.password_reset',
          entityType: 'user',
          entityId: user.id,
          metadata: {},
        },
        tx,
      );
    });

    // Any other still-unused reset tokens for this user are now stale — drop them so an
    // older emailed link can't also be used to change the password again.
    await prisma.passwordResetToken.deleteMany({
      where: { userId: user.id, usedAt: null },
    });

    return NextResponse.json({ userId: user.id, email: user.email }, { status: 200 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
