import { NextResponse } from 'next/server';
import { z } from 'zod';
import { InvalidRequestError, toErrorResponse } from '@/lib/api-errors';
import { logAudit } from '@/lib/audit';
import { withOrgContext } from '@/lib/db';
import {
  assertLogoUploadAllowed,
  createPresignedDownloadUrl,
  deleteObject,
  isOrganizationLogoKey,
} from '@/lib/s3';
import { requireRole, requireSession } from '@/lib/session';

const confirmBodySchema = z.object({
  storageKey: z.string().min(1),
  mimeType: z.string().min(1),
  sizeBytes: z.number().int().positive(),
});

/** Persists the org's logoStorageKey after the client finishes the S3 PUT, replacing
 * whatever logo was there before. Admins only. */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const session = await requireSession();
    requireRole(session, ['admin']);

    const body = confirmBodySchema.parse(await request.json());
    assertLogoUploadAllowed({ mimeType: body.mimeType, sizeBytes: body.sizeBytes });

    if (
      !isOrganizationLogoKey({
        storageKey: body.storageKey,
        organizationId: session.user.organizationId,
      })
    ) {
      throw new InvalidRequestError('storageKey does not belong to this organisation.');
    }

    const previousLogoStorageKey = await withOrgContext(session.user.organizationId, async (tx) => {
      const existing = await tx.organization.findUniqueOrThrow({
        where: { id: session.user.organizationId },
        select: { logoStorageKey: true },
      });

      await tx.organization.update({
        where: { id: session.user.organizationId },
        data: { logoStorageKey: body.storageKey },
      });

      await logAudit(
        {
          organizationId: session.user.organizationId,
          actorUserId: session.user.id,
          action: 'organization.logo_update',
          entityType: 'organization',
          entityId: session.user.organizationId,
          metadata: {},
        },
        tx,
      );

      return existing.logoStorageKey;
    });

    // Best-effort — an orphaned old logo object is harmless clutter, never worth
    // failing this request over (see deleteObject's doc comment).
    if (previousLogoStorageKey && previousLogoStorageKey !== body.storageKey) {
      try {
        await deleteObject(previousLogoStorageKey);
      } catch {
        // ignore
      }
    }

    let logoUrl: string | null = null;
    try {
      logoUrl = await createPresignedDownloadUrl({
        storageKey: body.storageKey,
        filename: 'logo',
        inline: true,
      });
    } catch {
      // Same soft-fail posture as the Files page — the key is saved even if minting a
      // display URL fails (usually a missing S3_BUCKET in local dev).
    }

    return NextResponse.json({ logoUrl });
  } catch (error) {
    return toErrorResponse(error);
  }
}
