import { NextResponse } from 'next/server';
import sharp from 'sharp';
import { toErrorResponse } from '@/lib/api-errors';
import { getObjectBytes, isOrganizationLogoKey } from '@/lib/s3';
import { getCurrentSubdomain, getOrganizationBySubdomain } from '@/lib/tenant';

// Public, no-auth route: gives share-link previews (WhatsApp/iMessage/Slack unfurls, etc.)
// a stable, non-expiring, square-cropped version of an org's uploaded logo, for use as
// generateMetadata's openGraph.images (see src/app/f/[slug]/page.tsx and its preview
// counterpart). Unlike every other image route in this app, this one can't just redirect
// to a presigned URL of the raw file (the pattern in
// /api/f/[slug]/fields/[fieldId]/image/route.ts) -- most uploaded logos are wide
// wordmarks, and link-unfurlers (WhatsApp in particular) render a wide/landscape OG image
// as a big banner across the top of the card, not the small square icon shown next to the
// title (compare a Microsoft/Google link preview, which uses a square icon). Padding the
// logo into a square fixes that: SIDE is a mnemonic for the square canvas size in px.
const SIDE = 400;

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

    const original = await getObjectBytes(organization.logoStorageKey);
    // 'contain' scales the whole logo down to fit inside the square without cropping any
    // of it, padding the rest with white -- a transparent PNG logo would otherwise render
    // on whatever background color the recipient's chat app happens to use.
    const square = await sharp(original)
      .flatten({ background: { r: 255, g: 255, b: 255 } })
      .resize(SIDE, SIDE, { fit: 'contain', background: { r: 255, g: 255, b: 255 } })
      .png()
      .toBuffer();

    return new NextResponse(square, {
      headers: {
        'Content-Type': 'image/png',
        // Long-ish cache: this URL only ever serves one org's current logo, and a logo
        // change is rare enough that a stale unfurl for up to a day is an acceptable
        // trade-off against reprocessing the image on every crawler hit.
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
