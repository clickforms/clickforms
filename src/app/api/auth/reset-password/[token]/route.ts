import { NextResponse } from 'next/server';
import { toErrorResponse } from '@/lib/api-errors';
import { prisma } from '@/lib/db';

interface RouteContext {
  params: Promise<{ token: string }>;
}

/** Public lookup for a password-reset link — no session required. */
export async function GET(_request: Request, { params }: RouteContext): Promise<NextResponse> {
  try {
    const { token } = await params;
    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { token },
      include: { user: { select: { email: true } } },
    });

    if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date()) {
      return NextResponse.json(
        { error: 'This password reset link is invalid or has expired.' },
        { status: 404 },
      );
    }

    return NextResponse.json({ email: resetToken.user.email });
  } catch (error) {
    return toErrorResponse(error);
  }
}
