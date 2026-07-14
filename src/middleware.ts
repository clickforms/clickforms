import { type NextRequest, NextResponse } from 'next/server';

// Public form pages only (ARCHITECTURE.md-style scope note): the admin dashboard
// (/forms, /login, /signup, etc.) always stays on the bare ROOT_DOMAIN — only the
// visitor-facing /f/* form pages (and the API routes they call) are subdomain-scoped,
// so a member of the public filling in a form sees which org they're submitting to
// right in the URL, e.g. carecircle.clickforms.com.au/f/intake-form.
//
// Middleware runs on the Edge runtime, which can't hold the Postgres connection
// src/lib/db.ts uses (PrismaPg over `pg`) — so this file does no database work. It only
// parses the request hostname and forwards the subdomain (if any) as a header for
// Server Components/Route Handlers to resolve against the database themselves (see
// src/lib/tenant.ts). Requests on the bare root domain get no header — the /f/[slug]
// page routes handle that case by looking up the form's org and redirecting to its
// subdomain (legacy/shared-link behavior).

export const config = {
  matcher: ['/f/:path*', '/api/f/:path*'],
};

const SUBDOMAIN_HEADER = 'x-org-subdomain';

/** Strips a port, if present, from a Host header value. */
function hostWithoutPort(host: string): string {
  return host.split(':')[0];
}

/**
 * Extracts the org subdomain label from a request host, given the app's root domain.
 * Returns null for the bare root domain, "www", or any host that isn't a subdomain of
 * ROOT_DOMAIN (e.g. an unrelated Host header) — callers treat null as "no tenant".
 */
export function resolveSubdomain(host: string, rootDomain: string): string | null {
  const bareHost = hostWithoutPort(host);
  const bareRoot = hostWithoutPort(rootDomain);

  if (bareHost === bareRoot) {
    return null;
  }

  const suffix = `.${bareRoot}`;
  if (!bareHost.endsWith(suffix)) {
    return null;
  }

  const label = bareHost.slice(0, -suffix.length);
  if (!label || label === 'www') {
    return null;
  }

  return label;
}

export function middleware(request: NextRequest) {
  const rootDomain = process.env.ROOT_DOMAIN ?? 'localhost:3000';
  const host = request.headers.get('host') ?? '';
  const subdomain = resolveSubdomain(host, rootDomain);

  const requestHeaders = new Headers(request.headers);
  if (subdomain) {
    requestHeaders.set(SUBDOMAIN_HEADER, subdomain);
  } else {
    requestHeaders.delete(SUBDOMAIN_HEADER);
  }

  return NextResponse.next({ request: { headers: requestHeaders } });
}
