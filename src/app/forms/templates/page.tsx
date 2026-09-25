import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import {
  type GalleryTemplate,
  TemplatesGalleryClient,
} from '@/app/forms/templates/templates-gallery-client';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { createPresignedDownloadUrl } from '@/lib/s3';

/**
 * Published templates only — any authenticated org member can browse (the actual
 * create-form permission check happens in POST /api/forms, same as "Blank form" in
 * create-form-modal.tsx). Plain `prisma` query, not `withOrgContext` — FormTemplate has
 * no organizationId (see its doc comment in prisma/schema.prisma).
 */
export default async function TemplatesGalleryPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect(`/login?callbackUrl=${encodeURIComponent('/forms/templates')}`);
  }

  const templates = await prisma.formTemplate.findMany({
    where: { status: 'published' },
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      description: true,
      industry: true,
      category: true,
      formType: true,
      thumbnailStorageKey: true,
      createdAt: true,
    },
  });

  const galleryTemplates: GalleryTemplate[] = await Promise.all(
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
        industry: template.industry,
        category: template.category,
        formType: template.formType,
        thumbnailUrl,
        createdAt: template.createdAt.toISOString(),
      };
    }),
  );

  return <TemplatesGalleryClient templates={galleryTemplates} />;
}
