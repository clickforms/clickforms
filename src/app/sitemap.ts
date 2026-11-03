import type { MetadataRoute } from 'next';
import { absoluteUrl } from '@/lib/seo/site';
import { SOLUTIONS } from '@/lib/seo/solutions';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const core: { path: string; priority: number }[] = [
    { path: '/', priority: 1 },
    { path: '/pricing', priority: 0.9 },
    { path: '/product/services', priority: 0.8 },
    { path: '/product/how-it-works', priority: 0.8 },
    { path: '/resources', priority: 0.7 },
    { path: '/help', priority: 0.6 },
    { path: '/contact', priority: 0.5 },
  ];
  return [
    ...core.map((p) => ({
      url: absoluteUrl(p.path),
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: p.priority,
    })),
    ...SOLUTIONS.map((s) => ({
      url: absoluteUrl(`/solutions/${s.slug}`),
      lastModified: now,
      changeFrequency: 'monthly' as const,
      priority: 0.85,
    })),
  ];
}
