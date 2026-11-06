import { z } from 'zod';

/** Organisation pre-header: the logo plus a block of info (right-aligned) that an org
 * admin configures once and can drop on top of any form created from a template. */
export const preheaderSchema = z.object({
  showLogo: z.boolean(),
  title: z.string().trim().max(120),
  details: z.string().trim().max(600),
});

export type OrgPreheader = z.infer<typeof preheaderSchema>;

export function parsePreheader(value: unknown): OrgPreheader | null {
  const parsed = preheaderSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function isPreheaderEmpty(preheader: OrgPreheader | null, hasLogo: boolean): boolean {
  if (!preheader) return true;
  return !(preheader.showLogo && hasLogo) && !preheader.title && !preheader.details;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Rich-text (HTML) body for the info block: bold title line, then one paragraph per line. */
export function preheaderInfoHtml(preheader: OrgPreheader): string {
  const parts: string[] = [];
  if (preheader.title) parts.push(`<p><strong>${escapeHtml(preheader.title)}</strong></p>`);
  for (const line of preheader.details.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed) parts.push(`<p>${escapeHtml(trimmed)}</p>`);
  }
  return parts.join('');
}
