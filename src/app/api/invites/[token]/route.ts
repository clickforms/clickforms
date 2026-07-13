import { NextResponse } from 'next/server';
import { toErrorResponse } from '@/lib/api-errors';
import { prisma } from '@/lib/db';
import { type InvitableRole, ROLE_DESCRIPTIONS, ROLE_LABELS } from '@/lib/user-roles';

interface RouteContext {
  params: Promise<{ token: string }>;
}

/** Public lookup for an invite link — no session required. */
export async function GET(_request: Request, { params }: RouteContext): Promise<NextResponse> {
  try {
    const { token } = await params;
    const invite = await prisma.userInvite.findUnique({
      where: { token },
      include: { organization: { select: { name: true } } },
    });

    if (!invite || invite.acceptedAt || invite.expiresAt < new Date()) {
      return NextResponse.json(
        { error: 'This invite link is invalid or has expired.' },
        { status: 404 },
      );
    }

    const role = invite.role as InvitableRole;
    return NextResponse.json({
      email: invite.email,
      name: invite.name,
      role,
      roleLabel: ROLE_LABELS[role] ?? invite.role,
      roleDescription: ROLE_DESCRIPTIONS[role] ?? '',
      organizationName: invite.organization.name,
      expiresAt: invite.expiresAt.toISOString(),
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
