import { NextResponse } from 'next/server';
import { NotFoundError, toErrorResponse } from '@/lib/api-errors';
import { prisma } from '@/lib/db';
import { deleteObject } from '@/lib/s3';
import { requirePlatformAdmin, requireSession } from '@/lib/session';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/** Removes a template's thumbnail — the gallery falls back to a generic template icon.
 * Platform admin only. */
export async function DELETE(_request: Request, { params }: RouteContext): Promise<NextResponse> {
  try {
    const session = await requireSession();
    requirePlatformAdmin(session);
    const { id } = await params;

    const existing = await prisma.formTemplate.findUnique({
      where: { id },
      select: { thumbnailStorageKey: true },
    });
    if (!existing) throw new NotFoundError('Template');

    if (!existing.thumbnailStorageKey) {
      return NextResponse.json({ ok: true });
    }

    await prisma.formTemplate.update({ where: { id }, data: { thumbnailStorageKey: null } });

    try {
      await deleteObject(existing.thumbnailStorageKey);
    } catch {
      // Best-effort, see deleteObject's doc comment.
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return toErrorResponse(error);
  }
}
