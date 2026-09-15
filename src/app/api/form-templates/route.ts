import { NextResponse } from 'next/server';
import { toErrorResponse } from '@/lib/api-errors';
import { prisma } from '@/lib/db';
import { createPresignedDownloadUrl } from '@/lib/s3';
import { requireSession } from '@/lib/session';

/**
 * Published templates only, for the /forms/templates gallery — any authenticated org
 * user can browse (not just admins; the create-form permission check still happens in
 * POST /api/forms). Plain `prisma` query, not `withOrgContext` — FormTemplate has no
 * organizationId, same as the admin-side list in
 * src/app/api/admin/form-templates/route.ts.
 */
export async function GET(): Promise<NextResponse> {
  try {
    await requireSession();

    const templates = await prisma.formTemplate.findMany({
      where: { status: 'published' },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        description: true,
        category: true,
        thumbnailStorageKey: true,
      },
    });

    const withThumbnails = await Promise.all(
      templates.map(async (template) => {
        let thumbnailUrl: string | null = null;
        if (template.thumbnailStorageKey) {
          try {
            thumbnailUrl = await createPresignedDownloadUrl({
              storageKey: template.thumbnailStorageKey,
              filename: 'thumbnail',
              inline: true,
            });
          } catch {
            // Soft-fail — a missing S3_BUCKET in local dev shouldn't break the whole
            // gallery, just that template's preview image.
          }
        }
        return {
          id: template.id,
          name: template.name,
          description: template.description,
          category: template.category,
          thumbnailUrl,
        };
      }),
    );

    return NextResponse.json({ templates: withThumbnails });
  } catch (error) {
    return toErrorResponse(error);
  }
}
