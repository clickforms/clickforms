import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { type TemplateRow, TemplatesListClient } from '@/app/admin/templates/templates-list-client';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { createPresignedDownloadUrl } from '@/lib/s3';

export default async function AdminTemplatesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isPlatformAdmin) {
    redirect('/forms');
  }

  const templates = await prisma.formTemplate.findMany({
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      name: true,
      description: true,
      industry: true,
      category: true,
      formType: true,
      status: true,
      thumbnailStorageKey: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  const initialTemplates: TemplateRow[] = await Promise.all(
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
          // Soft-fail — a missing S3_BUCKET in local dev shouldn't break the whole list,
          // just that template's preview image.
        }
      }
      return {
        id: template.id,
        name: template.name,
        description: template.description,
        industry: template.industry,
        category: template.category,
        formType: template.formType,
        status: template.status,
        thumbnailUrl,
        createdAt: template.createdAt.toISOString(),
        updatedAt: template.updatedAt.toISOString(),
      };
    }),
  );

  return <TemplatesListClient initialTemplates={initialTemplates} />;
}
