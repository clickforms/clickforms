import { NextResponse } from 'next/server';
import { z } from 'zod';
import { InvalidRequestError, toErrorResponse } from '@/lib/api-errors';
import { withOrgContext } from '@/lib/db';
import { assertUploadAllowed, createPresignedDownloadUrl, isLibraryStorageKey } from '@/lib/s3';
import { requireRole, requireSession } from '@/lib/session';

const confirmBodySchema = z.object({
  storageKey: z.string().min(1),
  filename: z.string().min(1).max(255),
  mimeType: z.string().min(1),
  sizeBytes: z.number().int().positive(),
});

/** Persist an organization_files row after the client finishes the S3 PUT. */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const session = await requireSession();
    requireRole(session, ['admin']);

    const body = confirmBodySchema.parse(await request.json());
    assertUploadAllowed({ mimeType: body.mimeType, sizeBytes: body.sizeBytes });

    if (
      !isLibraryStorageKey({
        storageKey: body.storageKey,
        organizationId: session.user.organizationId,
      })
    ) {
      throw new InvalidRequestError('storageKey does not belong to this organisation library.');
    }

    const file = await withOrgContext(session.user.organizationId, (tx) =>
      tx.organizationFile.create({
        data: {
          organizationId: session.user.organizationId,
          uploadedById: session.user.id,
          storageKey: body.storageKey,
          filename: body.filename,
          mimeType: body.mimeType,
          sizeBytes: body.sizeBytes,
        },
      }),
    );

    let downloadUrl: string | null = null;
    try {
      downloadUrl = await createPresignedDownloadUrl({
        storageKey: file.storageKey,
        filename: file.filename,
      });
    } catch {
      // Same soft-fail posture as the Files page: metadata is saved even if download
      // URL minting fails (usually missing S3_BUCKET in local env).
    }

    return NextResponse.json(
      {
        file: {
          id: file.id,
          filename: file.filename,
          mimeType: file.mimeType,
          sizeBytes: file.sizeBytes,
          uploadedAt: file.uploadedAt.toISOString(),
          downloadUrl,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}
