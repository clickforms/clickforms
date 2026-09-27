import { NextResponse } from 'next/server';
import { toErrorResponse } from '@/lib/api-errors';
import { prisma } from '@/lib/db';
import { requirePlatformAdmin, requireSession } from '@/lib/session';

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const session = await requireSession();
    requirePlatformAdmin(session);
    const { id } = await params;

    if (id === session.user.id) {
      return NextResponse.json(
        { error: 'You cannot remove yourself from the team.' },
        { status: 400 },
      );
    }

    const remainingAdmins = await prisma.user.count({
      where: { isPlatformAdmin: true, id: { not: id } },
    });
    if (remainingAdmins === 0) {
      return NextResponse.json(
        { error: 'At least one platform admin must remain.' },
        { status: 400 },
      );
    }

    const updated = await prisma.user.updateMany({
      where: { id, isPlatformAdmin: true },
      data: { isPlatformAdmin: false, platformAdminRole: null },
    });
    if (updated.count === 0) {
      return NextResponse.json({ error: 'Platform admin not found.' }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return toErrorResponse(error);
  }
}
