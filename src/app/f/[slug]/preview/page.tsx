import { notFound } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { FormRendererClient } from '@/app/f/[slug]/form-renderer-client';
import { authOptions } from '@/lib/auth';
import { withOrgContext } from '@/lib/db';
import { createEmptyFormSchema, type FormSchema, formSchemaSchema } from '@/lib/forms/schema';

interface PageProps {
  params: Promise<{ slug: string }>;
}

// Admin-only preview of a form, reachable at the same public URL shape as the live form
// (/f/[slug]) but nested one level deeper so it never collides with a real slug. Unlike
// /f/[slug]/page.tsx (which is deliberately unauthenticated and only ever serves the
// *published* version), this route is session-gated and always renders the *latest*
// FormVersion — including an unpublished draft — so an admin editing a form in the
// builder can see their in-progress changes without publishing first.
export default async function FormPreviewPage({ params }: PageProps) {
  const { slug } = await params;

  const session = await getServerSession(authOptions);
  if (!session?.user) {
    notFound();
  }

  const { form, version } = await withOrgContext(session.user.organizationId, async (tx) => {
    const form = await tx.form.findFirst({
      where: { slug, organizationId: session.user.organizationId },
    });
    if (!form) {
      return { form: null, version: null };
    }

    const version = await tx.formVersion.findFirst({
      where: { formId: form.id },
      orderBy: { versionNumber: 'desc' },
    });

    return { form, version };
  });

  if (!form) {
    notFound();
  }

  let schema: FormSchema;
  if (version) {
    const parsed = formSchemaSchema.safeParse(version.schema);
    schema = parsed.success ? parsed.data : createEmptyFormSchema();
  } else {
    schema = createEmptyFormSchema();
  }

  return (
    <div className="form-preview-shell">
      <div className="form-preview-banner">
        Preview — this is how your form looks to respondents. Nothing here is saved.
      </div>
      <FormRendererClient
        slug={form.slug}
        formId={form.id}
        formName={form.name}
        formVersionId={version?.id ?? ''}
        schema={schema}
        previewMode
      />
    </div>
  );
}
