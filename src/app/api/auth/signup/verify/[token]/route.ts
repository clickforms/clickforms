import { NextResponse } from 'next/server';
import { toErrorResponse } from '@/lib/api-errors';
import { prisma } from '@/lib/db';

interface RouteContext {
  params: Promise<{ token: string }>;
}

/** Public lookup for a signup-verification link — no session required. */
export async function GET(_request: Request, { params }: RouteContext): Promise<NextResponse> {
  try {
    const { token } = await params;
    const pendingSignup = await prisma.pendingSignup.findUnique({ where: { token } });

    if (!pendingSignup || pendingSignup.completedAt || pendingSignup.expiresAt < new Date()) {
      return NextResponse.json(
        { error: 'This verification link is invalid or has expired.' },
        { status: 404 },
      );
    }

    return NextResponse.json({
      organizationName: pendingSignup.organizationName,
      firstName: pendingSignup.firstName,
      email: pendingSignup.email,
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
