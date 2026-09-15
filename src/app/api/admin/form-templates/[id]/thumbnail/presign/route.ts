import { NextResponse } from 'next/server';
import { z } from 'zod';
import { NotFoundError, toErrorResponse } from '@/lib/api-errors';
import { prisma } from '@/lib/db';
import {
  assertTemplateThumbnailUploadAllowed,
  buildTemplateThumbnailKey,
  createPresignedUploadUrl,
} from '@/lib/s3';
import { requirePlatformAdmin, requireSession } from '@/lib/session';

interface RouteContext {
  params: Promise<{ id: string }>;
}

const presignBodySchema = z.object({
  filename: z.string().min(1).max(255),
  mimeType: z.string().min(1),
  sizeBytes: z.number().int().positive(),
});

/** Mint a short-lived S3 PUT URL for a template's gallery thumbnail. Platform admin only. */
export async function POST(request: Request, { params }: RouteContext): Promise<NextResponse> {
  try {
    const session = await requireSession();
    requirePlatformAdmin(session);
    const { id } = await params;

    const existing = await prisma.formTemplate.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw new NotFoundError('Template');

    const body = presignBodySchema.parse(await request.json());
    assertTemplateThumbnailUploadAllowed({ mimeType: body.mimeType, sizeBytes: body.sizeBytes });

    const storageKey = buildTemplateThumbnailKey({ templateId: id, filename: body.filename });
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
