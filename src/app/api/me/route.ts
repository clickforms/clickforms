import { NextResponse } from 'next/server';
import { z } from 'zod';
import { toErrorResponse } from '@/lib/api-errors';
import { logAudit } from '@/lib/audit';
import { withOrgContext } from '@/lib/db';
import { requireSession } from '@/lib/session';

const patchProfileBodySchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200).optional(),
  phone: z.string().trim().max(30).optional(),
});

/** Returns the signed-in user's profile. */
export async function GET(): Promise<NextResponse> {
  try {
    const session = await requireSession();

    const user = await withOrgContext(session.user.organizationId, (tx) =>
      tx.user.findFirstOrThrow({
        where: { id: session.user.id, organizationId: session.user.organizationId },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          role: true,
          createdAt: true,
        },
      }),
    );

    return NextResponse.json({
      user: {
        ...user,
        createdAt: user.createdAt.toISOString(),
      },
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}

/** Updates the signed-in user's own contact details. */
export async function PATCH(request: Request): Promise<NextResponse> {
  try {
    const session = await requireSession();
    const body = patchProfileBodySchema.parse(await request.json());

    const user = await withOrgContext(session.user.organizationId, async (tx) => {
      const updated = await tx.user.update({
        where: { id: session.user.id },
        data: {
          ...(body.name !== undefined ? { name: body.name } : {}),
          ...(body.phone !== undefined ? { phone: body.phone === '' ? null : body.phone } : {}),
        },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          role: true,
          createdAt: true,
        },
      });

      await logAudit(
        {
          organizationId: session.user.organizationId,
          actorUserId: session.user.id,
          action: 'user.profile_update',
          entityType: 'user',
          entityId: updated.id,
          metadata: {
            ...(body.name !== undefined ? { name: body.name } : {}),
            ...(body.phone !== undefined ? { phone: body.phone } : {}),
          },
        },
        tx,
      );

      return updated;
    });

    return NextResponse.json({
      user: {
        ...user,
        createdAt: user.createdAt.toISOString(),
      },
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
