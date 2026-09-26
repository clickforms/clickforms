import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';
import sharp from 'sharp';
import { toErrorResponse } from '@/lib/api-errors';
import { SHARE_LOGO_SIDE } from '@/lib/forms/share-metadata';
import { getObjectBytes, isOrganizationLogoKey } from '@/lib/s3';
import { getCurrentSubdomain, getOrganizationBySubdomain } from '@/lib/tenant';

// Public, no-auth route: square-pads an org's uploaded logo for share-link unfurls,
// falling back to Clickforms branding when the org has no usable logo. Can't redirect
// to a presigned raw file — most logos are wide wordmarks, and a landscape OG image is
// what WhatsApp renders as a banner across the top of the card.

export async function GET(): Promise<NextResponse> {
  try {
    const subdomain = await getCurrentSubdomain();
    if (!subdomain) {
      return NextResponse.json({ error: 'Logo not found.' }, { status: 404 });
    }

    const organization = await getOrganizationBySubdomain(subdomain);
    if (!organization) {
      return NextResponse.json({ error: 'Logo not found.' }, { status: 404 });
    }

    let original: Uint8Array | null = null;
    if (
      organization.logoStorageKey &&
      isOrganizationLogoKey({
        storageKey: organization.logoStorageKey,
        organizationId: organization.id,
      })
    ) {
      try {
        original = await getObjectBytes(organization.logoStorageKey);
      } catch {
        // A deleted/unreadable object should not remove the preview image entirely.
        // Fall through to the Clickforms logo just like an org with no uploaded logo.
      }
    }

    original ??= await readFile(path.join(process.cwd(), 'public', 'brand', 'logo.png'));

    // 'contain' scales the whole logo down to fit inside the square without cropping any
    // of it, padding the rest with white -- a transparent PNG logo would otherwise render
    // on whatever background color the recipient's chat app happens to use.
    const square = await sharp(original)
      .flatten({ background: { r: 255, g: 255, b: 255 } })
      .resize(SHARE_LOGO_SIDE, SHARE_LOGO_SIDE, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255 },
      })
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
