import { notFound } from 'next/navigation';
import { FormRendererClient } from '@/app/f/[slug]/form-renderer-client';
import { getFormSchemaByVersionId, getPublishedFormBySlug } from '@/lib/forms/public-lookup';

interface PageProps {
  params: Promise<{ slug: string }>;
}

// Public route, no session — specs/03-form-renderer.md: "An unauthenticated respondent
// can open a form's public URL... Draft versions are never publicly reachable." Only a
// form with status='published' resolves here, and only its currentVersionId's schema is
// ever shown (never a newer unpublished draft the admin might be mid-edit on).
export default async function PublicFormPage({ params }: PageProps) {
  const { slug } = await params;

  const form = await getPublishedFormBySlug(slug).catch(() => null);
  if (!form) {
    notFound();
  }

  const schema = await getFormSchemaByVersionId(form.currentVersionId).catch(() => null);
  if (!schema) {
    notFound();
  }

  return (
    <FormRendererClient
      slug={form.slug}
      formName={form.name}
      formVersionId={form.currentVersionId}
      schema={schema}
    />
  );
}
