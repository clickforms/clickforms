import { notFound, redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import {
  type TemplateDetail,
  TemplateSettingsClient,
} from '@/app/admin/templates/[id]/template-settings-client';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { createPresignedDownloadUrl } from '@/lib/s3';

export default async function TemplateSettingsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isPlatformAdmin) {
    redirect('/forms');
  }
  const { id } = await params;

  const template = await prisma.formTemplate.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      description: true,
      category: true,
      status: true,
      thumbnailStorageKey: true,
    },
  });
  if (!template) notFound();

  let thumbnailUrl: string | null = null;
  if (template.thumbnailStorageKey) {
    try {
      thumbnailUrl = await createPresignedDownloadUrl({
        storageKey: template.thumbnailStorageKey,
        filename: 'thumbnail',
        inline: true,
      });
    } catch {
      // Soft-fail — a missing S3_BUCKET in local dev shouldn't break this page, just
      // the thumbnail preview.
    }
  }

  const initialTemplate: TemplateDetail = {
    id: template.id,
    name: template.name,
    description: template.description,
    category: template.category,
    status: template.status,
    thumbnailUrl,
  };

  return <TemplateSettingsClient initialTemplate={initialTemplate} />;
}
