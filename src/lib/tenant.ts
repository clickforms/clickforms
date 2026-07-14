import 'server-only';

import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { NotFoundError } from '@/lib/api-errors';
import { prisma } from '@/lib/db';
import { findOrganizationSubdomainForSlug } from '@/lib/forms/public-lookup';

const SUBDOMAIN_HEADER = 'x-org-subdomain';

/**
 * Reads the org subdomain that src/middleware.ts resolved from the request hostname.
 * Only meaningful inside routes covered by the middleware matcher (/f/*, /api/f/*) —
 * returns null on the bare root domain (or outside that matcher), meaning "no tenant
 * resolved from the URL", which callers should treat as a legacy/shared-link request.
 */
export async function getCurrentSubdomain(): Promise<string | null> {
  const headerList = await headers();
  return headerList.get(SUBDOMAIN_HEADER);
}

/**
 * Looks up an Organization by its public subdomain. Runs against the plain `prisma`
 * client rather than `withOrgContext` — same deliberate RLS-bypass exception as
 * src/lib/auth.ts login and src/lib/forms/public-lookup.ts: the organizationId isn't
 * known yet, that's exactly what this call is resolving.
 */
export async function getOrganizationBySubdomain(subdomain: string) {
  return prisma.organization.findUnique({
    where: { subdomain },
    select: { id: true, name: true, subdomain: true },
  });
}

/** Builds the root-relative-safe absolute origin for an org's public subdomain, e.g. "https://carecircle.clickforms.com.au". */
export function buildOrgOrigin(subdomain: string): string {
  const rootDomain = process.env.ROOT_DOMAIN ?? 'localhost:3000';
  // Local dev has no TLS termination in front of `next dev`; everywhere else (staging,
  // production) is served over Caddy, which always terminates HTTPS. See NEXTAUTH_URL's
  // http://localhost:3000 in .env.example for the same dev-only http:// precedent.
  const protocol = rootDomain.startsWith('localhost') ? 'http' : 'https';
  return `${protocol}://${subdomain}.${rootDomain}`;
}

/** Builds an absolute public form URL on an org's subdomain, e.g. buildOrgFormUrl("carecircle", "intake-form") -> "https://carecircle.clickforms.com.au/f/intake-form". */
export function buildOrgFormUrl(subdomain: string, path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${buildOrgOrigin(subdomain)}${normalizedPath}`;
}

/**
 * For the three /f/[slug] page routes (browser navigations, not API calls): resolves
 * the organizationId to scope the slug lookup with. On the bare root domain (no
 * subdomain header — a legacy/shared link from before subdomains existed), redirects
 * the browser to the correct org subdomain, per user decision to 302 old links rather
 * than 404 or serve them in place. `redirect()`/`notFound()` both throw internally, so
 * every path either returns an organizationId or never returns.
 */
export async function resolveOrganizationIdForSlugOrRedirect(
  slug: string,
  redirectPath: string,
): Promise<string> {
  const subdomain = await getCurrentSubdomain();
  if (subdomain) {
    const organization = await getOrganizationBySubdomain(subdomain);
    if (!organization) {
      notFound();
    }
    return organization.id;
  }

  const orgSubdomain = await findOrganizationSubdomainForSlug(slug);
  if (!orgSubdomain) {
    notFound();
  }
  redirect(buildOrgFormUrl(orgSubdomain, redirectPath));
}

/**
 * For the /api/f/[slug]/* route handlers (fetch calls made by a page already rendered
 * on the correct org subdomain, not top-level browser navigations) — no legacy-link
 * redirect here, since a fetch() redirect can't usefully resubmit a POST body. A
 * missing/unresolved subdomain on these routes means a direct API call bypassing normal
 * page navigation, which is indistinguishable from the form not existing.
 */
export async function resolveOrganizationIdOrThrow(): Promise<string> {
  const subdomain = await getCurrentSubdomain();
  if (!subdomain) {
    throw new NotFoundError('Form');
  }
  const organization = await getOrganizationBySubdomain(subdomain);
  if (!organization) {
    throw new NotFoundError('Form');
  }
  return organization.id;
}
