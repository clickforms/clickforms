import type { Metadata } from 'next';
import { buildOrgFormUrl } from '@/lib/tenant';

// WhatsApp treats og:image as a full-width banner when the file is 300px wide or more
// (see developers.facebook.com/docs/whatsapp/link-previews). A square under that
// threshold is what produces the compact card with the logo on the left — the Microsoft
// "My Account" style — instead of the logo stretched across the top.
export const SHARE_LOGO_SIDE = 256;

export function publicFormShareMetadata(options: {
  organizationName: string;
  subdomain: string;
  hasLogo: boolean;
}): Metadata {
  const title = options.organizationName;
  if (!options.hasLogo) {
    return {
      title,
      description: '',
      twitter: { card: 'summary', title },
      openGraph: { title, type: 'website' },
    };
  }

  // `s=` is part of the URL so crawlers that already cached the previous 400px banner
  // fetch this smaller thumbnail as a new image.
  const logoUrl = buildOrgFormUrl(options.subdomain, `/api/f/logo?s=${SHARE_LOGO_SIDE}`);
  const sizes = `${SHARE_LOGO_SIDE}x${SHARE_LOGO_SIDE}`;

  return {
    title,
    description: '',
    icons: {
      icon: [{ url: logoUrl, sizes, type: 'image/png' }],
      apple: [{ url: logoUrl, sizes, type: 'image/png' }],
    },
    twitter: { card: 'summary', title, images: [logoUrl] },
    openGraph: {
      title,
      type: 'website',
      images: [{ url: logoUrl, width: SHARE_LOGO_SIDE, height: SHARE_LOGO_SIDE }],
    },
  };
}
