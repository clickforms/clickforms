import { NextResponse } from 'next/server';
import { NotFoundError, toErrorResponse } from '@/lib/api-errors';
import { logAudit } from '@/lib/audit';
import { prisma, withOrgContext } from '@/lib/db';
import { requirePlatformAdmin, requireSession } from '@/lib/session';
import { issuePasswordReset } from '@/lib/users/issue-password-reset';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * Support action on /admin/users: emails the user a one-hour reset link and returns
 * the URL so the platform admin can copy it. Unlike public forgot-password, this
 * names the user (the admin already has the directory in front of them).
 */
export async function POST(_request: Request, { params }: RouteContext): Promise<NextResponse> {
  try {
    const session = await requireSession();
    requirePlatformAdmin(session);
    const { id } = await params;

    const existing = await prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, name: true, organizationId: true },
    });
    if (!existing?.organizationId) throw new NotFoundError('User');
    const organizationId = existing.organizationId;

    const resetUrl = await issuePasswordReset(existing);

    await withOrgContext(organizationId, async (tx) => {
      await logAudit(
        {
          organizationId,
          actorUserId: session.user.id,
          action: 'admin.user_password_reset',
          entityType: 'user',
          entityId: id,
          metadata: { email: existing.email },
        },
        tx,
      );
    });

    return NextResponse.json({ ok: true, resetUrl });
  } catch (error) {
    return toErrorResponse(error);
  }
}
