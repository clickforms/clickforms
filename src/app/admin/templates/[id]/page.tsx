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

  const [template, facetRows] = await Promise.all([
    prisma.formTemplate.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        description: true,
        industry: true,
        category: true,
        formType: true,
        status: true,
        thumbnailStorageKey: true,
      },
    }),
    // Suggestions for the three TaxonomyField inputs below — every distinct value
    // already used for that facet across the whole library, not just this template.
    prisma.formTemplate.findMany({
      select: { industry: true, category: true, formType: true },
    }),
  ]);
  if (!template) notFound();

  function distinctValues(rows: typeof facetRows, facet: 'industry' | 'category' | 'formType') {
    return Array.from(new Set(rows.map((row) => row[facet]).filter(Boolean))).sort() as string[];
  }

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
    industry: template.industry,
    category: template.category,
    formType: template.formType,
    status: template.status,
    thumbnailUrl,
  };

  return (
    <TemplateSettingsClient
      initialTemplate={initialTemplate}
      industryOptions={distinctValues(facetRows, 'industry')}
      categoryOptions={distinctValues(facetRows, 'category')}
      formTypeOptions={distinctValues(facetRows, 'formType')}
    />
  );
}
