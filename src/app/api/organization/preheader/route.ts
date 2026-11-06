import { NextResponse } from 'next/server';
import { assertOrgActionsAllowed } from '@/lib/admin/plan-enforcement';
import { InvalidRequestError, toErrorResponse } from '@/lib/api-errors';
import { logAudit } from '@/lib/audit';
import { withOrgContext } from '@/lib/db';
import { parsePreheader, preheaderSchema } from '@/lib/org-preheader';
import { createPresignedDownloadUrl, deleteObject, isOrganizationLogoKey } from '@/lib/s3';
import { requireOrganizationId, requireRole, requireSession } from '@/lib/session';

/** Saves the organisation pre-header design. Admins only. The pre-header's own logo is
 * uploaded with the existing /api/organization/logo/presign flow (same org_id/logo/ key
 * space) and only referenced here — it never replaces the workspace logo. */
export async function PUT(request: Request): Promise<NextResponse> {
  try {
    const session = await requireSession();
    requireRole(session, ['admin']);
    const body = preheaderSchema.parse(await request.json()) as ReturnType<typeof parsePreheader>;
    if (!body) throw new InvalidRequestError('Invalid pre-header.');
    const orgId = requireOrganizationId(session);

    if (
      body.logoStorageKey &&
      !isOrganizationLogoKey({ storageKey: body.logoStorageKey, organizationId: orgId })
    ) {
      throw new InvalidRequestError('Logo does not belong to this organisation.');
    }

    const previousKey = await withOrgContext(session.user.organizationId, async (tx) => {
      await assertOrgActionsAllowed(tx, orgId);
      const existing = await tx.organization.findUniqueOrThrow({
        where: { id: orgId },
        select: { preheader: true, logoStorageKey: true },
      });
      await tx.organization.update({ where: { id: orgId }, data: { preheader: body } });
      await logAudit(
        {
          organizationId: orgId,
          actorUserId: session.user.id,
          action: 'organization.details_update',
          entityType: 'organization',
          entityId: orgId,
          metadata: { preheader: true },
        },
        tx,
      );
      const previous = parsePreheader(existing.preheader)?.logoStorageKey;
      // Never delete the workspace logo, even if an old pre-header pointed at it.
      return previous && previous !== body.logoStorageKey && previous !== existing.logoStorageKey
        ? previous
        : null;
    });

    if (previousKey) {
      try {
        await deleteObject(previousKey);
      } catch {
        // Best-effort: an orphaned object is harmless.
      }
    }

    let logoUrl: string | null = null;
    if (body.logoStorageKey) {
      try {
        logoUrl = await createPresignedDownloadUrl({
          storageKey: body.logoStorageKey,
          filename: 'logo',
          inline: true,
        });
      } catch {
        // Soft-fail like the other logo routes.
      }
    }

    return NextResponse.json({ preheader: body, logoUrl });
  } catch (error) {
    return toErrorResponse(error);
  }
}
