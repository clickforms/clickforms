import { NextResponse } from 'next/server';
import { z } from 'zod';
import { InvalidRequestError, toErrorResponse } from '@/lib/api-errors';
import { logAudit } from '@/lib/audit';
import { revokeTwoFactorTrust } from '@/lib/auth/two-factor';
import { prisma, withOrgContext } from '@/lib/db';
import { requireOrganizationId, requireSession } from '@/lib/session';
import { hashPassword, passwordSchema, verifyPassword } from '@/lib/users/password';

const changePasswordBodySchema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password'),
    newPassword: passwordSchema,
    confirmPassword: z.string().min(1, 'Confirm your new password'),
  })
  .refine((body) => body.newPassword === body.confirmPassword, {
    message: 'New passwords do not match.',
    path: ['confirmPassword'],
  });

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const session = await requireSession();
    const body = changePasswordBodySchema.parse(await request.json());

    if (body.currentPassword === body.newPassword) {
      throw new InvalidRequestError('New password must be different from your current password.');
    }

    const user = await prisma.user.findFirst({
      where: { id: session.user.id, email: session.user.email ?? undefined },
    });
    if (!user) {
      throw new InvalidRequestError('Account not found.');
    }

    const currentValid = await verifyPassword(body.currentPassword, user.passwordHash);
    if (!currentValid) {
      throw new InvalidRequestError('Current password is incorrect.');
    }

    const passwordHash = await hashPassword(body.newPassword);

    if (!session.user.organizationId) {
      await prisma.user.update({
        where: { id: session.user.id },
        data: { passwordHash },
      });
      await revokeTwoFactorTrust(session.user.id);
      return NextResponse.json({ ok: true });
    }

    await withOrgContext(session.user.organizationId, async (tx) => {
      await tx.user.update({
        where: { id: session.user.id },
        data: { passwordHash },
      });

      await logAudit(
        {
          organizationId: requireOrganizationId(session),
          actorUserId: session.user.id,
          action: 'user.password_change',
          entityType: 'user',
          entityId: session.user.id,
        },
        tx,
      );
    });

    // A new password ends the 24-hour two-step trust: the next sign-in asks for a code.
    await revokeTwoFactorTrust(session.user.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return toErrorResponse(error);
  }
}
