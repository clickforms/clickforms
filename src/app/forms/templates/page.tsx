import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import type { GalleryTemplate } from '@/app/forms/templates/gallery-template';
import { TemplatesGalleryClient } from '@/app/forms/templates/templates-gallery-client';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { formSchemaSchema } from '@/lib/forms/schema';
import { createPresignedDownloadUrl } from '@/lib/s3';

const STRUCTURAL_FIELD_TYPES = new Set(['column_layout', 'section_break', 'divider', 'hidden']);

function galleryExtras(
  schemaJson: unknown,
): Pick<GalleryTemplate, 'layoutStyle' | 'fieldCount' | 'fieldLabels'> {
  const parsed = formSchemaSchema.safeParse(schemaJson);
  if (!parsed.success) {
    return { layoutStyle: 'default', fieldCount: 0, fieldLabels: [] };
  }
  const labels: string[] = [];
  for (const field of Object.values(parsed.data.fields)) {
    if (STRUCTURAL_FIELD_TYPES.has(field.type)) continue;
    if ('label' in field && typeof field.label === 'string' && field.label.trim()) {
      labels.push(field.label.trim());
    }
  }
  return {
    layoutStyle: parsed.data.branding.layoutStyle ?? 'default',
    fieldCount: labels.length,
    fieldLabels: labels.slice(0, 8),
  };
}

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
      schema: true,
      creator: { select: { name: true } },
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
      const extras = galleryExtras(template.schema);
      return {
        id: template.id,
        name: template.name,
        description: template.description,
        industry: template.industry,
        category: template.category,
        formType: template.formType,
        thumbnailUrl,
        createdAt: template.createdAt.toISOString(),
        createdByName: template.creator.name?.trim() || 'Clickforms',
        ...extras,
      };
    }),
  );

  return <TemplatesGalleryClient templates={galleryTemplates} />;
}
