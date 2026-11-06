import { NextResponse } from 'next/server';
import { z } from 'zod';
import { InvalidRequestError, toErrorResponse } from '@/lib/api-errors';
import { logAudit } from '@/lib/audit';
import { revokeTwoFactorTrust } from '@/lib/auth/two-factor';
import { withUserScope } from '@/lib/auth/user-scope';
import { requireSession } from '@/lib/session';
import { verifyPassword } from '@/lib/users/password';

const bodySchema = z.object({ password: z.string().min(1) });

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const session = await requireSession();
    const { password } = bodySchema.parse(await request.json());

    await withUserScope(session.user.organizationId, async (tx) => {
      const user = await tx.user.findUnique({ where: { id: session.user.id } });
      if (!user) throw new InvalidRequestError('Account not found.');
      if (!(await verifyPassword(password, user.passwordHash))) {
        throw new InvalidRequestError('Password is incorrect.');
      }

      await tx.user.update({ where: { id: user.id }, data: { twoFactorEnabled: false } });
      if (user.organizationId) {
        await logAudit(
          {
            organizationId: user.organizationId,
            actorUserId: user.id,
            action: 'user.2fa_disabled',
            entityType: 'user',
            entityId: user.id,
            metadata: {},
          },
          tx,
        );
      }
    });
    await revokeTwoFactorTrust(session.user.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return toErrorResponse(error);
  }
}
