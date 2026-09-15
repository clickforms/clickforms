import { NextResponse } from 'next/server';
import { NotFoundError, toErrorResponse } from '@/lib/api-errors';
import { logAudit } from '@/lib/audit';
import { prisma, withOrgContext } from '@/lib/db';
import { requirePlatformAdmin, requireSession } from '@/lib/session';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * Turns a user's two-factor toggle back off, for the "Reset 2FA" action on
 * /admin/users — a support action for someone locked out of their authenticator, since
 * enrollment itself has no backend yet (see two-factor-client.tsx). Requires the
 * user's organizationId to run through withOrgContext like every other admin write.
 */
export async function POST(_request: Request, { params }: RouteContext): Promise<NextResponse> {
  try {
    const session = await requireSession();
    requirePlatformAdmin(session);
    const { id } = await params;

    const existing = await prisma.user.findUnique({
      where: { id },
      select: { id: true, organizationId: true },
    });
    if (!existing?.organizationId) throw new NotFoundError('User');
    const organizationId = existing.organizationId;

    await withOrgContext(organizationId, async (tx) => {
      await tx.user.update({ where: { id }, data: { twoFactorEnabled: false } });

      await logAudit(
        {
          organizationId,
          actorUserId: session.user.id,
          action: 'admin.user_2fa_reset',
          entityType: 'user',
          entityId: id,
          metadata: {},
        },
        tx,
      );
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return toErrorResponse(error);
  }
}
