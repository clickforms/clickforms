import { NextResponse } from 'next/server';
import { z } from 'zod';
import { toErrorResponse } from '@/lib/api-errors';
import { logAudit } from '@/lib/audit';
import { withOrgContext } from '@/lib/db';
import { assertFormEditAccess } from '@/lib/form-access';
import { unpublishForm } from '@/lib/forms/form-workflow';
import { requireOrganizationId, requireRole, requireSession } from '@/lib/session';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// `intent` doesn't change the underlying transition (see unpublishForm) — it's purely
// for a clearer audit log entry, distinguishing "clicked Edit on a live form" from an
// explicit "Take offline" so the org Logs page reads accurately.
const unpublishBodySchema = z.object({
  intent: z.enum(['edit', 'pause']).optional(),
});

/** Takes a live form offline and resets it to draft (currentVersionId cleared). */
export async function POST(request: Request, { params }: RouteContext): Promise<NextResponse> {
  try {
    const session = await requireSession();
    requireRole(session, ['admin', 'editor', 'member']);
    const { id } = await params;
    const body = unpublishBodySchema.parse(await request.json().catch(() => ({})));

    const result = await withOrgContext(session.user.organizationId, async (tx) => {
      const form = await tx.form.findFirst({
        where: { id, organizationId: requireOrganizationId(session) },
      });
      assertFormEditAccess(form, session.user.role, session.user.id);

      const { form: updatedForm, version } = await unpublishForm(tx, form);

      await logAudit(
        {
          organizationId: requireOrganizationId(session),
          actorUserId: session.user.id,
          action: 'form.unpublish',
          entityType: 'form',
          entityId: form.id,
          metadata: {
            intent: body.intent ?? 'pause',
            ...(version ? { versionNumber: version.versionNumber } : {}),
          },
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
