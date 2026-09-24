import { NextResponse } from 'next/server';
import { toErrorResponse } from '@/lib/api-errors';
import { createPresignedDownloadUrl, isOrganizationLogoKey } from '@/lib/s3';
import { getCurrentSubdomain, getOrganizationBySubdomain } from '@/lib/tenant';

// Public, no-auth route: gives share-link previews (WhatsApp/iMessage/Slack unfurls, etc.)
// a stable, non-expiring URL for an org's uploaded logo, so it can be embedded in
// generateMetadata's openGraph.images (see src/app/f/[slug]/page.tsx). The raw presigned
// URL from createPresignedDownloadUrl only lives 5 minutes (see lib/s3.ts expiresIn: 300)
// -- far too short for a URL a crawler might fetch or re-fetch at any time -- so this
// route regenerates a fresh one on every request instead, mirroring the pattern in
// /api/f/[slug]/fields/[fieldId]/image/route.ts.
//
// Not nested under /f/[slug] because the logo belongs to the organization, not any one
// form -- src/middleware.ts's matcher (['/f/:path*', '/api/f/:path*']) covers this path
// regardless, so the subdomain header still resolves here.
export async function GET(): Promise<NextResponse> {
  try {
    const subdomain = await getCurrentSubdomain();
    if (!subdomain) {
      return NextResponse.json({ error: 'Logo not found.' }, { status: 404 });
    }

    const organization = await getOrganizationBySubdomain(subdomain);
    if (!organization?.logoStorageKey) {
      return NextResponse.json({ error: 'Logo not found.' }, { status: 404 });
    }

    if (
      !isOrganizationLogoKey({
        storageKey: organization.logoStorageKey,
        organizationId: organization.id,
      })
    ) {
      return NextResponse.json({ error: 'Invalid logo reference.' }, { status: 404 });
    }

    const url = await createPresignedDownloadUrl({
      storageKey: organization.logoStorageKey,
      filename: 'logo',
      inline: true,
    });
    return NextResponse.redirect(url, 302);
  } catch (error) {
    return toErrorResponse(error);
  }
}
