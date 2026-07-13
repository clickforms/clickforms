import { NextResponse } from 'next/server';
import { NotFoundError, toErrorResponse } from '@/lib/api-errors';
import { withOrgContext } from '@/lib/db';
import { requireRole, requireSession } from '@/lib/session';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/** Delete an admin-uploaded library file (metadata only — S3 object left for later cleanup). */
export async function DELETE(_request: Request, { params }: RouteContext): Promise<NextResponse> {
  try {
    const session = await requireSession();
    requireRole(session, ['admin']);
    const { id } = await params;

    await withOrgContext(session.user.organizationId, async (tx) => {
      const existing = await tx.organizationFile.findFirst({
        where: { id, organizationId: session.user.organizationId },
        select: { id: true },
      });
      if (!existing) throw new NotFoundError('File');
      await tx.organizationFile.delete({ where: { id } });
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
