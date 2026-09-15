import { NextResponse } from 'next/server';
import { toErrorResponse } from '@/lib/api-errors';
import { logAudit } from '@/lib/audit';
import { withOrgContext } from '@/lib/db';
import { deleteObject } from '@/lib/s3';
import { requireOrganizationId, requireRole, requireSession } from '@/lib/session';

/** Removes the org's uploaded logo — reverts the workspace sidebar to the default
 * Clickforms wordmark. Admins only. */
export async function DELETE(): Promise<NextResponse> {
  try {
    const session = await requireSession();
    requireRole(session, ['admin']);

    const previousLogoStorageKey = await withOrgContext(session.user.organizationId, async (tx) => {
      const existing = await tx.organization.findUniqueOrThrow({
        where: { id: requireOrganizationId(session) },
        select: { logoStorageKey: true },
      });

      if (!existing.logoStorageKey) return null;

      await tx.organization.update({
        where: { id: requireOrganizationId(session) },
        data: { logoStorageKey: null },
      });

      await logAudit(
        {
          organizationId: requireOrganizationId(session),
          actorUserId: session.user.id,
          action: 'organization.logo_remove',
          entityType: 'organization',
          entityId: requireOrganizationId(session),
          metadata: {},
        },
        tx,
      );

      return existing.logoStorageKey;
    });

    if (previousLogoStorageKey) {
      try {
        await deleteObject(previousLogoStorageKey);
      } catch {
        // Best-effort, see deleteObject's doc comment.
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return toErrorResponse(error);
  }
}
