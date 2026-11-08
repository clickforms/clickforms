import { NextResponse } from 'next/server';
import { z } from 'zod';
import { NotFoundError, toErrorResponse } from '@/lib/api-errors';
import { prisma } from '@/lib/db';
import { reviewStatusSchema } from '@/lib/reviews/schema';
import { requirePlatformAdmin, requireSession } from '@/lib/session';

const patchSchema = z.object({ status: reviewStatusSchema });

/** Approve, hide or restore a review. Platform admin only. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const session = await requireSession();
    requirePlatformAdmin(session);
    const { id } = await params;
    const { status } = patchSchema.parse(await request.json());

    const existing = await prisma.review.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw new NotFoundError('Review');

    const review = await prisma.review.update({
      where: { id },
      data: { status, moderatedAt: new Date(), moderatedByEmail: session.user.email },
      select: { id: true, status: true, moderatedAt: true },
    });
    return NextResponse.json({
      review: { id: review.id, status: review.status, moderatedAt: review.moderatedAt },
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}

/** Permanently deletes a review. Platform admin only. */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const session = await requireSession();
    requirePlatformAdmin(session);
    const { id } = await params;
    const existing = await prisma.review.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw new NotFoundError('Review');
    await prisma.review.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return toErrorResponse(error);
  }
}
