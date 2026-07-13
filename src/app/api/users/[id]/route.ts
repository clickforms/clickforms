import { NextResponse } from 'next/server';
import { z } from 'zod';
import { InvalidRequestError, NotFoundError, toErrorResponse } from '@/lib/api-errors';
import { logAudit } from '@/lib/audit';
import { withOrgContext } from '@/lib/db';
import { requireRole, requireSession } from '@/lib/session';
import { INVITABLE_ROLES } from '@/lib/user-roles';
import { assertNotLastAdmin, assertNotSelf } from '@/lib/users/management';

interface RouteContext {
  params: Promise<{ id: string }>;
}

const patchUserBodySchema = z
  .object({
    name: z.string().trim().min(1, 'Name is required').max(200).optional(),
    role: z.enum(INVITABLE_ROLES).optional(),
  })
  .refine((body) => body.name !== undefined || body.role !== undefined, {
    message: 'Provide a name or role to update.',
  });

export async function PATCH(request: Request, { params }: RouteContext): Promise<NextResponse> {
  try {
    const session = await requireSession();
    requireRole(session, ['admin']);
    const { id } = await params;
    const body = patchUserBodySchema.parse(await request.json());

    const user = await withOrgContext(session.user.organizationId, async (tx) => {
      const existing = await tx.user.findFirst({
        where: { id, organizationId: session.user.organizationId },
      });
      if (!existing) throw new NotFoundError('User');

      if (body.role !== undefined && body.role !== existing.role) {
        assertNotSelf(session.user.id, existing.id);
        await assertNotLastAdmin(
          tx,
          session.user.organizationId,
          existing.id,
          existing.role,
          body.role,
        );
      }

      const updated = await tx.user.update({
        where: { id: existing.id },
        data: {
          ...(body.name !== undefined ? { name: body.name } : {}),
          ...(body.role !== undefined ? { role: body.role } : {}),
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          createdAt: true,
        },
      });

      await logAudit(
        {
          organizationId: session.user.organizationId,
          actorUserId: session.user.id,
          action: 'user.update',
          entityType: 'user',
          entityId: updated.id,
          metadata: {
            ...(body.name !== undefined ? { name: body.name } : {}),
            ...(body.role !== undefined ? { role: body.role } : {}),
          },
        },
        tx,
      );

      return updated;
    });

    return NextResponse.json({
      user: { ...user, createdAt: user.createdAt.toISOString() },
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function DELETE(_request: Request, { params }: RouteContext): Promise<NextResponse> {
  try {
    const session = await requireSession();
    requireRole(session, ['admin']);
    const { id } = await params;

    await withOrgContext(session.user.organizationId, async (tx) => {
      const existing = await tx.user.findFirst({
        where: { id, organizationId: session.user.organizationId },
      });
      if (!existing) throw new NotFoundError('User');

      assertNotSelf(session.user.id, existing.id);
      await assertNotLastAdmin(tx, session.user.organizationId, existing.id, existing.role);

      const formsOwned = await tx.form.count({ where: { createdBy: existing.id } });
      if (formsOwned > 0) {
        throw new InvalidRequestError(
          'This user still owns forms. Transfer or delete their forms before removing them.',
        );
      }

      const pendingApprovals = await tx.workflowStep.count({
        where: { approverUserId: existing.id, status: 'pending' },
      });
      if (pendingApprovals > 0) {
        throw new InvalidRequestError(
          'This user has pending approval steps. Reassign them before removing this user.',
        );
      }

      await tx.user.delete({ where: { id: existing.id } });

      await logAudit(
        {
          organizationId: session.user.organizationId,
          actorUserId: session.user.id,
          action: 'user.remove',
          entityType: 'user',
          entityId: existing.id,
          metadata: { email: existing.email },
        },
        tx,
      );
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return toErrorResponse(error);
  }
}
