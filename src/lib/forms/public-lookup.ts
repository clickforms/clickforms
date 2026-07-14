import type { Form, Submission } from '@prisma/client';
import { NotFoundError } from '@/lib/api-errors';
import { prisma } from '@/lib/db';
import { type FormSchema, formSchemaSchema } from '@/lib/forms/schema';

// Lookups shared by the unauthenticated public routes — the renderer page
// (src/app/f/[slug]/page.tsx) and the submission API routes under
// src/app/api/f/[slug]/. All of them start from a slug with no session, so
// organizationId isn't known yet.
//
// Deliberate exception to the withOrgContext(...) rule in src/lib/db.ts, same shape as
// the credentials lookup in src/lib/auth.ts: this one query runs directly against the
// top-level `prisma` client. Every write that follows a lookup here still goes through
// withOrgContext(form.organizationId, ...), same as every other mutating route.

/** A published form always has a currentVersionId — publish() sets both together
 * (src/app/api/forms/[id]/publish/route.ts) — so callers can rely on the narrowed type.
 *
 * `organizationId` is required: `forms.slug` is only unique per-org (schema.prisma
 * `@@unique([organizationId, slug])`), so an unscoped lookup could return the wrong
 * org's form once more than one org has forms. Callers resolve organizationId from the
 * request's subdomain first — see src/lib/tenant.ts getOrganizationBySubdomain and the
 * legacy-link fallback findOrganizationSubdomainForSlug below. */
export async function getPublishedFormBySlug(
  slug: string,
  organizationId: string,
): Promise<Form & { currentVersionId: string }> {
  const form = await prisma.form.findFirst({
    where: { slug, status: 'published', organizationId },
  });
  if (!form?.currentVersionId) {
    throw new NotFoundError('Form');
  }
  return form as Form & { currentVersionId: string };
}

/**
 * Resolves which org's subdomain a bare-root-domain /f/[slug] request should redirect
 * to — legacy/shared-link support for URLs from before subdomains existed. Slugs aren't
 * globally unique, so if two orgs happen to share a slug this picks the older form
 * (created first); that ambiguity is inherent to a pre-subdomain link and only affects
 * this one-time redirect, not any authenticated or org-scoped query. Returns null if no
 * form anywhere has this slug (a genuine 404, not a tenant-resolution problem).
 */
export async function findOrganizationSubdomainForSlug(slug: string): Promise<string | null> {
  const form = await prisma.form.findFirst({
    where: { slug },
    select: { organization: { select: { subdomain: true } } },
    orderBy: { createdAt: 'asc' },
  });
  return form?.organization.subdomain ?? null;
}

export async function getFormSchemaByVersionId(formVersionId: string): Promise<FormSchema> {
  const version = await prisma.formVersion.findUnique({ where: { id: formVersionId } });
  if (!version) {
    throw new NotFoundError('Form version');
  }
  const parsed = formSchemaSchema.safeParse(version.schema);
  if (!parsed.success) {
    // Every write path validates against formSchemaSchema before persisting (see
    // src/app/forms/[id]/builder/page.tsx's identical fallback comment) — this only
    // fires if the JSONB was altered out-of-band.
    console.error(
      `[public-lookup] form_version ${formVersionId} failed formSchemaSchema`,
      parsed.error,
    );
    throw new NotFoundError('Form version');
  }
  return parsed.data;
}

/** A submission scoped to a specific form — used by the upload/patch routes to make sure
 * a submissionId in the URL actually belongs to the form the slug resolved to, not some
 * other org's submission. */
export async function getSubmissionForForm(params: {
  formId: string;
  submissionId: string;
}): Promise<Submission> {
  const submission = await prisma.submission.findFirst({
    where: { id: params.submissionId, formId: params.formId },
  });
  if (!submission) {
    throw new NotFoundError('Submission');
  }
  return submission;
}

/** Best-effort respondent IP for the submissions row — proxied through Caddy in
 * production (ARCHITECTURE.md §0), which sets X-Forwarded-For; falls back to null
 * rather than throwing, since this is metadata, not something request handling depends on. */
export function getRequestIp(request: Request): string | null {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0]?.trim() ?? null;
  }
  return null;
}
