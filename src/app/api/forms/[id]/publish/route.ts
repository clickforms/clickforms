import { NextResponse } from 'next/server';
import { toErrorResponse } from '@/lib/api-errors';
import { logAudit } from '@/lib/audit';
import { withOrgContext } from '@/lib/db';
import { assertFormEditAccess } from '@/lib/form-access';
import { publishForm } from '@/lib/forms/form-workflow';
import { requireRole, requireSession } from '@/lib/session';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/** Publishes an approved form (approved → published). */
export async function POST(_request: Request, { params }: RouteContext): Promise<NextResponse> {
  try {
    const session = await requireSession();
    requireRole(session, ['admin', 'editor', 'member']);
    const { id } = await params;

    const result = await withOrgContext(session.user.organizationId, async (tx) => {
      const form = await tx.form.findFirst({
        where: { id, organizationId: session.user.organizationId },
      });
      assertFormEditAccess(form, session.user.role, session.user.id);

      const { form: updatedForm, version } = await publishForm(tx, form);

      await logAudit(
        {
          organizationId: session.user.organizationId,
          actorUserId: session.user.id,
          action: 'form.publish',
          entityType: 'form_version',
          entityId: version.id,
          metadata: { versionNumber: version.versionNumber },
        },
        tx,
      );

      return { form: updatedForm, version };
    });

    return NextResponse.json(result);
  } catch (error) {
    return toErrorResponse(error);
  }
}
