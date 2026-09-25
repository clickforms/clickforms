import { NextResponse } from 'next/server';
import { z } from 'zod';
import { InvalidRequestError, toErrorResponse } from '@/lib/api-errors';
import { logAudit } from '@/lib/audit';
import { prisma, withOrgContext } from '@/lib/db';
import { hashPassword, passwordSchema } from '@/lib/users/password';

const resetPasswordBodySchema = z.object({
  token: z.string().min(1),
  password: passwordSchema,
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

    const passwordHash = await hashPassword(password);
    const { user } = resetToken;

    if (!user.organizationId) {
      await prisma.user.update({
        where: { id: user.id },
        data: { passwordHash },
      });
      await prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { usedAt: new Date() },
      });
    } else {
      // Captured into a local so the narrowing from the `if (!user.organizationId)`
      // check above survives into this closure — TS can't carry a narrowed property
      // access (`user.organizationId`) through an async callback boundary, but a const
      // assigned from it keeps the non-null type.
      const organizationId = user.organizationId;
      await withOrgContext(organizationId, async (tx) => {
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
            organizationId,
            actorUserId: user.id,
            action: 'user.password_reset',
            entityType: 'user',
            entityId: user.id,
            metadata: {},
          },
          tx,
        );
      });
    }

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
