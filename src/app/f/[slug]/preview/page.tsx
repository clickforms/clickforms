import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { FormRendererClient } from '@/app/f/[slug]/form-renderer-client';
import { authOptions } from '@/lib/auth';
import { prisma, withOrgContext } from '@/lib/db';
import { createEmptyFormSchema, type FormSchema, formSchemaSchema } from '@/lib/forms/schema';
import { requireOrganizationId } from '@/lib/session';
import { buildOrgFormUrl, getCurrentSubdomain, getOrganizationBySubdomain } from '@/lib/tenant';

interface PageProps {
  params: Promise<{ slug: string }>;
}

// Same share-link-branding override as /f/[slug]/page.tsx's generateMetadata (see the
// comment there for the full rationale) — an admin sharing a preview link to show a
// colleague a draft, or accidentally sharing one instead of the live link (as happened in
// the WhatsApp screenshots that prompted this), gets the same "Clickforms" + org logo
// unfurl rather than the generic default. Note this runs unauthenticated (link-preview
// crawlers never carry the admin's session cookie), so it can't reuse the session-based
// org lookup below — it resolves the org from the subdomain instead, same as the public
// page. A direct prisma.form.findFirst (no withOrgContext) is a deliberate bypass here,
// same shape as the one documented in lib/forms/public-lookup.ts: this only confirms the
// form exists for that org so metadata isn't shown for a slug that doesn't belong to it,
// it's not the auth gate — the page component's session check above is what actually
// protects the draft content.
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  try {
    const subdomain = await getCurrentSubdomain();
    if (!subdomain) return {};

    const organization = await getOrganizationBySubdomain(subdomain);
    if (!organization) return {};

    const form = await prisma.form.findFirst({
      where: { slug, organizationId: organization.id },
      select: { id: true },
    });
    if (!form) return {};

    const title = 'Clickforms';
    if (!organization.logoStorageKey) {
      return { title, description: '', openGraph: { title } };
    }

    const logoUrl = buildOrgFormUrl(subdomain, '/api/f/logo');
    return {
      title,
      description: '',
      // width/height must match SIDE in /api/f/logo/route.ts -- telling the crawler the
      // image is square up front is what makes WhatsApp/etc. show it as a small icon next
      // to the title instead of a large banner across the top of the card.
      openGraph: { title, images: [{ url: logoUrl, width: 400, height: 400 }] },
    };
  } catch {
    return {};
  }
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

  // Unlike /forms/**, this route has no layout that already gates on organizationId — a
  // platform-only admin (isPlatformAdmin, no org membership) has no form to preview
  // anyway, so treat a missing org the same as a missing session rather than letting
  // withOrgContext throw a raw "organizationId is required" error.
  if (!session.user.organizationId) {
    notFound();
  }

  const { form, version } = await withOrgContext(session.user.organizationId, async (tx) => {
    const form = await tx.form.findFirst({
      where: { slug, organizationId: requireOrganizationId(session) },
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
