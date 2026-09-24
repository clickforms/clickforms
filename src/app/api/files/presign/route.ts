import { NextResponse } from 'next/server';
import { z } from 'zod';
import { assertWithinStorageLimit } from '@/lib/admin/plan-limits';
import { toErrorResponse } from '@/lib/api-errors';
import { withOrgContext } from '@/lib/db';
import { assertUploadAllowed, buildLibraryStorageKey, createPresignedUploadUrl } from '@/lib/s3';
import { requireOrganizationId, requireRole, requireSession } from '@/lib/session';

const presignBodySchema = z.object({
  filename: z.string().min(1).max(255),
  mimeType: z.string().min(1),
  sizeBytes: z.number().int().positive(),
});

/** Mint a short-lived S3 PUT URL for an admin library upload on the Files page. */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const session = await requireSession();
    requireRole(session, ['admin']);

    const body = presignBodySchema.parse(await request.json());
    assertUploadAllowed({ mimeType: body.mimeType, sizeBytes: body.sizeBytes });

    // Checked at presign time, before the client's S3 PUT — a blocked upload should never
    // actually land in S3 just to be rejected at /api/files/confirm afterward.
    await withOrgContext(session.user.organizationId, async (tx) => {
      const organization = await tx.organization.findUnique({
        where: { id: requireOrganizationId(session) },
        select: { plan: true },
      });
      await assertWithinStorageLimit(
        tx,
        requireOrganizationId(session),
        organization?.plan ?? 'standard',
        body.sizeBytes,
      );
    });

    const storageKey = buildLibraryStorageKey({
      organizationId: requireOrganizationId(session),
      filename: body.filename,
    });
    const uploadUrl = await createPresignedUploadUrl({
      storageKey,
      mimeType: body.mimeType,
      sizeBytes: body.sizeBytes,
    });

    return NextResponse.json({ uploadUrl, storageKey });
  } catch (error) {
    return toErrorResponse(error);
  }
}
