import { NextResponse } from 'next/server';
import { z } from 'zod';
import { InvalidRequestError, toErrorResponse } from '@/lib/api-errors';
import { logAudit } from '@/lib/audit';
import { verifyTwoFactorCode } from '@/lib/auth/two-factor';
import { withUserScope } from '@/lib/auth/user-scope';
import { requireSession } from '@/lib/session';

const bodySchema = z.object({ code: z.string().min(1) });

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const session = await requireSession();
    const { code } = bodySchema.parse(await request.json());

    if (!(await verifyTwoFactorCode(session.user.id, 'enable', code))) {
      throw new InvalidRequestError('That code is incorrect or has expired.');
    }

    await withUserScope(session.user.organizationId, async (tx) => {
      const user = await tx.user.update({
        where: { id: session.user.id },
        data: { twoFactorEnabled: true },
        select: { organizationId: true },
      });
      if (user.organizationId) {
        await logAudit(
          {
            organizationId: user.organizationId,
            actorUserId: session.user.id,
            action: 'user.2fa_enabled',
            entityType: 'user',
            entityId: session.user.id,
            metadata: {},
          },
          tx,
        );
      }
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return toErrorResponse(error);
  }
}
