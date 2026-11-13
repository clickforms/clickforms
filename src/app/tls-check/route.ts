import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { resolveSubdomain } from '@/proxy';

// Caddy's on-demand TLS "ask" endpoint (Caddyfile.staging). Before Caddy requests a Let's
// Encrypt certificate for a hostname it has never seen, it calls
//   http://app:3000/tls-check?domain=<hostname>
// and only proceeds on a 200. Without this check anyone could point arbitrary hostnames at the
// box and make it burn certificate-issuance rate limits. We answer 200 only when the hostname
// is `<org-subdomain>.<ROOT_DOMAIN>` for an organisation that really exists.
//
// Internal only: Caddy calls it over the docker network with Host "app:3000". A request that
// arrives through the public site carries the public Host header and gets a 404.

const INTERNAL_HOST = 'app:3000';
const SINGLE_LABEL = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;

export async function GET(request: Request): Promise<NextResponse> {
  if (request.headers.get('host') !== INTERNAL_HOST) {
    return new NextResponse(null, { status: 404 });
  }

  const domain = new URL(request.url).searchParams.get('domain')?.toLowerCase() ?? '';
  const rootDomain = process.env.ROOT_DOMAIN;
  if (!domain || !rootDomain) {
    return new NextResponse(null, { status: 404 });
  }

  const subdomain = resolveSubdomain(domain, rootDomain);
  if (!subdomain || !SINGLE_LABEL.test(subdomain)) {
    return new NextResponse(null, { status: 404 });
  }

  const organization = await prisma.organization.findUnique({
    where: { subdomain },
    select: { id: true },
  });
  return new NextResponse(null, { status: organization ? 200 : 404 });
}
