import { NextResponse } from 'next/server';
import { z } from 'zod';
import { InvalidRequestError, NotFoundError, toErrorResponse } from '@/lib/api-errors';
import { prisma } from '@/lib/db';
import {
  assertTemplateThumbnailUploadAllowed,
  createPresignedDownloadUrl,
  deleteObject,
  isTemplateThumbnailKey,
} from '@/lib/s3';
import { requirePlatformAdmin, requireSession } from '@/lib/session';

interface RouteContext {
  params: Promise<{ id: string }>;
}

const confirmBodySchema = z.object({
  storageKey: z.string().min(1),
  mimeType: z.string().min(1),
  sizeBytes: z.number().int().positive(),
});

/** Persists a template's thumbnailStorageKey after the client finishes the S3 PUT,
 * replacing whatever thumbnail was there before. Platform admin only. */
export async function POST(request: Request, { params }: RouteContext): Promise<NextResponse> {
  try {
    const session = await requireSession();
    requirePlatformAdmin(session);
    const { id } = await params;

    const body = confirmBodySchema.parse(await request.json());
    assertTemplateThumbnailUploadAllowed({ mimeType: body.mimeType, sizeBytes: body.sizeBytes });

    if (!isTemplateThumbnailKey({ storageKey: body.storageKey, templateId: id })) {
      throw new InvalidRequestError('storageKey does not belong to this template.');
    }

    const existing = await prisma.formTemplate.findUnique({
      where: { id },
      select: { thumbnailStorageKey: true },
    });
    if (!existing) throw new NotFoundError('Template');

    await prisma.formTemplate.update({
      where: { id },
      data: { thumbnailStorageKey: body.storageKey },
    });

    // Best-effort — an orphaned old thumbnail object is harmless clutter, never worth
    // failing this request over (see deleteObject's doc comment).
    if (existing.thumbnailStorageKey && existing.thumbnailStorageKey !== body.storageKey) {
      try {
        await deleteObject(existing.thumbnailStorageKey);
      } catch {
        // ignore
      }
    }

    let thumbnailUrl: string | null = null;
    try {
      thumbnailUrl = await createPresignedDownloadUrl({
        storageKey: body.storageKey,
        filename: 'thumbnail',
        inline: true,
      });
    } catch {
      // Same soft-fail posture as the org logo route — the key is saved even if minting
      // a display URL fails (usually a missing S3_BUCKET in local dev).
    }

    return NextResponse.json({ thumbnailUrl });
  } catch (error) {
    return toErrorResponse(error);
  }
}
