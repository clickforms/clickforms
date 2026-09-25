import { notFound, redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { FormRendererClient } from '@/app/f/[slug]/form-renderer-client';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { createEmptyFormSchema, type FormSchema, formSchemaSchema } from '@/lib/forms/schema';

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ embed?: string; card?: string }>;
}

/**
 * Read-only preview of a published template's fields/layout, opened in an iframe from the
 * Preview action on /forms/templates (see template-preview-modal.tsx) so an org user can
 * see what they'd get before committing to "Use this template". Reuses the same
 * FormRendererClient + previewMode as the admin draft-preview route
 * (src/app/f/[slug]/preview/page.tsx) — there's no real Form/FormVersion/slug for a
 * template, so every network side effect previewMode short-circuits (submission creation,
 * uploads) is exactly what we want here too.
 *
 * Deliberately NOT under /forms/templates/[id]/preview: everything under src/app/forms
 * inherits forms/layout.tsx, which wraps children in the full AdminShellClient
 * (sidebar/topbar/org-join-banner) — fine for a normal page, but this route is meant to be
 * embedded bare in an iframe inside a modal, so it'd otherwise render the whole app shell
 * nested inside itself. Living as its own top-level segment (mirroring src/app/f, which
 * /f/[slug]/preview relies on the same way) keeps it chrome-free. Published-only for
 * regular org users — same gate as the gallery itself (src/app/forms/templates/page.tsx)
 * and the org-side list API. Platform admins can preview any status (draft/archived
 * included), since this doubles as the Preview action from /admin/templates and the admin
 * template builder — those need to see a template before it's published.
 */
export default async function TemplatePreviewPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { embed: embedParam, card: cardParam } = await searchParams;
  const embed = embedParam === '1';
  const card = embed && cardParam === '1';

  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect(`/login?callbackUrl=${encodeURIComponent(`/template-preview/${id}`)}`);
  }

  const template = await prisma.formTemplate.findFirst({
    where: session.user.isPlatformAdmin ? { id } : { id, status: 'published' },
    select: { id: true, name: true, schema: true },
  });
  if (!template) {
    notFound();
  }

  const parsed = formSchemaSchema.safeParse(template.schema);
  const schema: FormSchema = parsed.success ? parsed.data : createEmptyFormSchema();

  const renderer = (
    <FormRendererClient
      slug=""
      templateId={template.id}
      formName={template.name}
      formVersionId=""
      schema={schema}
      previewMode
    />
  );

  return (
    <div
      className={
        embed
          ? `public-form-layout form-preview-embed${card ? ' form-preview-embed--card' : ''}`
          : 'public-form-layout'
      }
    >
      {embed ? (
        renderer
      ) : (
        <div className="form-preview-shell">
          <div className="form-preview-banner">
            Template preview — this is how it'll look. Nothing here is saved.
          </div>
          {renderer}
        </div>
      )}
    </div>
  );
}
