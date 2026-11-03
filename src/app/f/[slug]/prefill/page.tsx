import { notFound } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { FormRendererClient } from '@/app/f/[slug]/form-renderer-client';
import { authOptions } from '@/lib/auth';
import { withOrgContext } from '@/lib/db';
import { type FormSchema, formSchemaSchema } from '@/lib/forms/schema';
import { requireOrganizationId } from '@/lib/session';

interface PageProps {
  params: Promise<{ slug: string }>;
}

// Admin-only page for building a prefilled link: renders the live form, the admin fills in
// whatever answers they want pre-populated, and instead of submitting they get a shareable
// URL (POST /api/forms/[id]/prefill-link). Session-gated and nothing is saved.
export default async function FormPrefillPage({ params }: PageProps) {
  const { slug } = await params;

  const session = await getServerSession(authOptions);
  if (!session?.user?.organizationId) {
    notFound();
  }

  const { form, version } = await withOrgContext(session.user.organizationId, async (tx) => {
    const form = await tx.form.findFirst({
      where: { slug, organizationId: requireOrganizationId(session) },
    });
    if (!form?.currentVersionId) {
      return { form: null, version: null };
    }
    const version = await tx.formVersion.findFirst({
      where: { id: form.currentVersionId, organizationId: requireOrganizationId(session) },
    });
    return { form, version };
  });

  if (!form || !version) {
    notFound();
  }

  const parsed = formSchemaSchema.safeParse(version.schema);
  if (!parsed.success) {
    notFound();
  }
  const schema: FormSchema = parsed.data;

  return (
    <div className="form-preview-shell">
      <div className="form-preview-banner">
        Fill in the answers you want pre-populated, then generate the link. Nothing here is saved or
        submitted.
      </div>
      <FormRendererClient
        slug={form.slug}
        formId={form.id}
        formName={form.name}
        formVersionId={version.id}
        schema={schema}
        previewMode
        prefillBuilder
      />
    </div>
  );
}
