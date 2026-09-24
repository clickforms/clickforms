import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { FormRendererClient } from '@/app/f/[slug]/form-renderer-client';
import { FormOfflineError } from '@/lib/api-errors';
import { getFormSchemaByVersionId, getPublishedFormBySlug } from '@/lib/forms/public-lookup';
import { publicFormShareMetadata } from '@/lib/forms/share-metadata';
import {
  getCurrentSubdomain,
  getOrganizationBySubdomain,
  resolveOrganizationIdForSlugOrRedirect,
} from '@/lib/tenant';

interface PageProps {
  params: Promise<{ slug: string }>;
}

// Share links (WhatsApp/iMessage/Slack unfurls, etc.) previously inherited the root
// layout's generic "Clickforms — Internal forms & workflows" title, long description, and
// Clickforms logo image -- confusing for a respondent who's never heard of the platform
// and just wants to know whose form this is. This overrides all of that per-form with the
// org's own name as the title, no description, plus the org's own uploaded logo as the
// preview image when they have one (falls back to the inherited default image otherwise).
//
// Deliberately doesn't use resolveOrganizationIdForSlugOrRedirect: that throws
// redirect()/notFound() internally for the legacy bare-domain case, which is the right
// behavior for a page navigation but not for a metadata resolver that should just fall
// back quietly. Any failure here (no subdomain, org lookup, or form lookup) means "can't
// customize this one", not "this page 404s" -- the page component's own resolution is
// what actually gates the page.
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  try {
    const subdomain = await getCurrentSubdomain();
    if (!subdomain) return {};

    const organization = await getOrganizationBySubdomain(subdomain);
    if (!organization) return {};

    const form = await getPublishedFormBySlug(slug, organization.id).catch(() => null);
    if (!form) return {};

    return publicFormShareMetadata({
      organizationName: organization.name,
      subdomain,
      hasLogo: Boolean(organization.logoStorageKey),
    });
  } catch {
    return {};
  }
}

// Public route, no session — specs/03-form-renderer.md: "An unauthenticated respondent
// can open a form's public URL... Draft versions are never publicly reachable." Only a
// form with a currentVersionId resolves here (see getPublishedFormBySlug), and only that
// version's schema is ever shown — never a newer draft the admin might be mid-edit on,
// even while status has moved off 'published' for that draft's own approval pipeline.
export default async function PublicFormPage({ params }: PageProps) {
  const { slug } = await params;

  const organizationId = await resolveOrganizationIdForSlugOrRedirect(slug, `/f/${slug}`);

  let form: Awaited<ReturnType<typeof getPublishedFormBySlug>> | null = null;
  try {
    form = await getPublishedFormBySlug(slug, organizationId);
  } catch (error) {
    // A trial-expired org's forms are a distinct case from "this form doesn't exist" —
    // the link itself is fine, it's just temporarily not accepting responses, so this
    // gets its own message rather than the generic 404 every other lookup failure here
    // falls back to.
    if (error instanceof FormOfflineError) {
      return (
        <div className="form-renderer">
          <div className="form-renderer-body form-success">
            <h1>This form isn&apos;t accepting responses right now</h1>
            <p>Please check back later, or contact the organisation directly.</p>
          </div>
        </div>
      );
    }
    notFound();
  }
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
