import { NextResponse } from 'next/server';
import { z } from 'zod';
import { toErrorResponse } from '@/lib/api-errors';
import { assertUploadAllowed, buildLibraryStorageKey, createPresignedUploadUrl } from '@/lib/s3';
import { requireRole, requireSession } from '@/lib/session';

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

    const storageKey = buildLibraryStorageKey({
      organizationId: session.user.organizationId,
      filename: body.filename,
    });
    const uploadUrl = await createPresignedUploadUrl({
      storageKey,
      mimeType: body.mimeType,
    });

    return NextResponse.json({ uploadUrl, storageKey });
  } catch (error) {
    return toErrorResponse(error);
  }
}
