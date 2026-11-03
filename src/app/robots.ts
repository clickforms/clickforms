import type { MetadataRoute } from 'next';
import { headers } from 'next/headers';
import { absoluteUrl, isIndexableHost } from '@/lib/seo/site';

// Production marketing pages are crawlable; the app, API, login flows and every /f/ client form
// stay blocked. Staging, localhost and org subdomains are blocked entirely.
export default async function robots(): Promise<MetadataRoute.Robots> {
  const host = (await headers()).get('host');
  if (!isIndexableHost(host)) {
    return { rules: { userAgent: '*', disallow: '/' } };
  }
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/api/',
        '/f/',
        '/forms',
        '/admin',
        '/login',
        '/signup',
        '/forgot-password',
        '/reset-password',
        '/team/',
        '/template-preview',
      ],
    },
    sitemap: absoluteUrl('/sitemap.xml'),
    host: absoluteUrl('/'),
  };
}
