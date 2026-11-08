import type { Metadata } from 'next';

// Single source of truth for the public marketing site's SEO. Only the production root domain
// is indexable — staging, localhost and every org subdomain (where client form pages live)
// stay fully blocked, because those pages hold private intake/consent forms.

export const SITE_NAME = 'Clickforms';
export const PRODUCTION_ROOT_DOMAIN = 'clickforms.com.au';

export function rootDomain(): string {
  return process.env.ROOT_DOMAIN ?? 'localhost:3000';
}

export function isIndexableHost(host: string | null | undefined): boolean {
  if (!host) return false;
  const bare = host.split(':')[0]?.replace(/^www\./, '');
  return bare === PRODUCTION_ROOT_DOMAIN && rootDomain().split(':')[0] === PRODUCTION_ROOT_DOMAIN;
}

export function siteUrl(): string {
  const domain = rootDomain();
  const local = domain.startsWith('localhost') || domain.startsWith('127.');
  return `${local ? 'http' : 'https'}://${domain}`;
}

export function absoluteUrl(path: string): string {
  return `${siteUrl()}${path === '/' ? '' : path}`;
}

export const DEFAULT_KEYWORDS = [
  'form builder',
  'online form builder',
  'custom forms',
  'online forms',
  'form builder Australia',
  'intake forms',
  'consent forms',
  'e-signature forms',
  'NDIS forms',
  'service agreement forms',
  'digital forms',
];

/** Per-page metadata with a canonical URL and matching Open Graph / Twitter tags. */
export function pageMetadata(params: {
  path: string;
  title: string;
  description: string;
  keywords?: string[];
}): Metadata {
  const url = absoluteUrl(params.path);
  return {
    title: { absolute: params.title },
    description: params.description,
    keywords: params.keywords,
    alternates: { canonical: url },
    openGraph: {
      type: 'website',
      url,
      title: params.title,
      description: params.description,
      siteName: SITE_NAME,
      locale: 'en_AU',
      images: [{ url: '/brand/logo.png', width: 666, height: 184, alt: SITE_NAME }],
    },
    twitter: { card: 'summary', title: params.title, description: params.description },
  };
}

export function organizationJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE_NAME,
    url: siteUrl(),
    logo: absoluteUrl('/brand/icon-192.png'),
    areaServed: 'AU',
  };
}

export function websiteJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    url: siteUrl(),
    inLanguage: 'en-AU',
  };
}

export function softwareJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: SITE_NAME,
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    description:
      'Online form builder for custom intake, consent and service agreement forms with e-signatures, conditional logic, approval workflows and audit trails.',
    url: siteUrl(),
  };
}

export function faqJsonLd(faqs: readonly { q: string; a: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };
}

export function breadcrumbJsonLd(items: readonly { name: string; path: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}
