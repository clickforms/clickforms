import { NextResponse } from 'next/server';
import { PLATFORM_ADMIN_ROLE_LABELS } from '@/lib/admin/platform-admin-roles';
import { toErrorResponse } from '@/lib/api-errors';
import { prisma } from '@/lib/db';

interface RouteContext {
  params: Promise<{ token: string }>;
}

/** Public lookup for a /admin "Team" invite link — no session required, mirrors
 * GET /api/invites/[token]. */
export async function GET(_request: Request, { params }: RouteContext): Promise<NextResponse> {
  try {
    const { token } = await params;
    const invite = await prisma.platformAdminInvite.findUnique({ where: { token } });

    if (!invite || invite.acceptedAt || invite.expiresAt < new Date()) {
      return NextResponse.json(
        { error: 'This invite link is invalid or has expired.' },
        { status: 404 },
      );
    }

    return NextResponse.json({
      email: invite.email,
      name: invite.name,
      role: invite.role,
      roleLabel: PLATFORM_ADMIN_ROLE_LABELS[invite.role],
      expiresAt: invite.expiresAt.toISOString(),
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
