import { NextResponse } from 'next/server';
import { z } from 'zod';
import { InvalidRequestError, NotFoundError, toErrorResponse } from '@/lib/api-errors';
import { logAudit } from '@/lib/audit';
import { withOrgContext } from '@/lib/db';
import { assertFormEditAccess } from '@/lib/form-access';
import { requireRole, requireSession } from '@/lib/session';

interface RouteContext {
  params: Promise<{ id: string }>;
}

const transferBodySchema = z.object({
  newOwnerId: z.string().min(1),
});

/**
 * Hands a form's ownership to another org member. Gated the same as any other edit
 * (assertFormEditAccess — creator, or admin/editor), not creator-only like the isPrivate
 * toggle: an admin cleaning up a departing user's forms needs to be able to do this even
 * though they didn't create the form. If the form is private, it stays private and simply
 * becomes visible only to the new owner (matches the existing "isPrivate is always
 * relative to the current creator" semantics — see canViewForm).
 */
export async function POST(request: Request, { params }: RouteContext): Promise<NextResponse> {
  try {
    const session = await requireSession();
    requireRole(session, ['admin', 'editor', 'member']);
    const { id } = await params;
    const body = transferBodySchema.parse(await request.json());

    const result = await withOrgContext(session.user.organizationId, async (tx) => {
      const form = await tx.form.findFirst({
        where: { id, organizationId: session.user.organizationId },
      });
      assertFormEditAccess(form, session.user.role, session.user.id);

      if (body.newOwnerId === form.createdBy) {
        throw new InvalidRequestError('This form is already owned by that user.');
      }

      const newOwner = await tx.user.findFirst({
        where: { id: body.newOwnerId, organizationId: session.user.organizationId },
        select: { id: true, name: true, email: true },
      });
      if (!newOwner) throw new NotFoundError('User');

      const updated = await tx.form.update({
        where: { id: form.id },
        data: { createdBy: newOwner.id },
      });

      await logAudit(
        {
          organizationId: session.user.organizationId,
          actorUserId: session.user.id,
          action: 'form.transfer',
          entityType: 'form',
          entityId: form.id,
          metadata: { fromUserId: form.createdBy, toUserId: newOwner.id },
        },
        tx,
      );

      return { form: updated, newOwnerName: newOwner.name ?? newOwner.email };
    });

    return NextResponse.json(result);
  } catch (error) {
    return toErrorResponse(error);
  }
}
