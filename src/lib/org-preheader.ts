import { z } from 'zod';
import type { FormField } from '@/lib/forms/schema';

/** Organisation pre-header: a customisable header block (logo + rich text) that an org admin
 * designs once and can drop on top of any form created from a template. */
export const PREHEADER_LAYOUTS = ['logo-left', 'logo-right', 'stacked'] as const;
export type PreheaderLayout = (typeof PREHEADER_LAYOUTS)[number];

export const PREHEADER_LAYOUT_LABEL: Record<PreheaderLayout, string> = {
  'logo-left': 'Logo left',
  'logo-right': 'Logo right',
  stacked: 'Centred',
};

export const PREHEADER_LOGO_SIZES = ['small', 'medium', 'large'] as const;
export type PreheaderLogoSize = (typeof PREHEADER_LOGO_SIZES)[number];

export const PREHEADER_BODY_MAX_LENGTH = 20000;

/** Defence in depth: the body is authored by an admin through the rich-text editor, which
 * never emits these, but it's copied onto every form — so reject anything script-like
 * if a client posts raw HTML directly. */
function isSafeBody(html: string): boolean {
  return !/<\s*(script|iframe|object|embed)\b|javascript:|\son[a-z]+\s*=/i.test(html);
}

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/);

const preheaderObjectSchema = z.object({
  showLogo: z.boolean(),
  /** Pre-header-specific logo (org_id/logo/... key). Absent = use the organisation logo. */
  logoStorageKey: z.string().min(1).optional(),
  layout: z.enum(PREHEADER_LAYOUTS).default('logo-left'),
  logoSize: z.enum(PREHEADER_LOGO_SIZES).default('medium'),
  /** Rich-text HTML from the shared editor. */
  body: z.string().max(PREHEADER_BODY_MAX_LENGTH).refine(isSafeBody, 'Unsupported content'),
  backgroundColor: hexColor.optional(),
  showDivider: z.boolean().default(false),
});

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** First-generation shape was { showLogo, title, details } — plain text. Converted to the
 * rich-text body so previously saved pre-headers keep working. */
function migrateLegacy(value: unknown): unknown {
  if (!value || typeof value !== 'object') return value;
  const record = value as Record<string, unknown>;
  if (typeof record.body === 'string') return value;
  const title = typeof record.title === 'string' ? record.title.trim() : '';
  const details = typeof record.details === 'string' ? record.details : '';
  const parts: string[] = [];
  if (title) parts.push(`<p><strong>${escapeHtml(title)}</strong></p>`);
  for (const line of details.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed) parts.push(`<p>${escapeHtml(trimmed)}</p>`);
  }
  return { showLogo: record.showLogo, body: parts.join('') };
}

export const preheaderSchema = z.preprocess(migrateLegacy, preheaderObjectSchema);

export type OrgPreheader = z.infer<typeof preheaderObjectSchema>;

export function parsePreheader(value: unknown): OrgPreheader | null {
  const parsed = preheaderSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function defaultPreheader(orgName: string): OrgPreheader {
  return {
    showLogo: true,
    layout: 'logo-left',
    logoSize: 'medium',
    body: orgName.trim() ? `<p><strong>${escapeHtml(orgName.trim())}</strong></p>` : '',
    showDivider: false,
  };
}

/** True when the rich-text body has no visible content (tags/whitespace only). */
export function isBodyEmpty(body: string): boolean {
  return (
    body
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .trim().length === 0
  );
}

export function isPreheaderEmpty(preheader: OrgPreheader | null, hasLogo: boolean): boolean {
  if (!preheader) return true;
  return !(preheader.showLogo && hasLogo) && isBodyEmpty(preheader.body);
}

/** Resolves which stored object the logo comes from: the pre-header's own upload, else the
 * organisation logo. */
export function resolvePreheaderLogoKey(
  preheader: OrgPreheader | null,
  orgLogoStorageKey: string | null | undefined,
): string | null {
  if (!preheader?.showLogo) return null;
  return preheader.logoStorageKey ?? orgLogoStorageKey ?? null;
}

interface BuiltPreheader {
  /** Fields to merge into schema.fields. */
  fields: Record<string, FormField>;
  /** Ids to prepend to the first page's `fields` array, in order. */
  order: string[];
}

/** Turns a pre-header design into form-schema fields. `logo` is the image already copied to
 * a form-scoped storage key; its `fieldId` MUST be the id baked into that key
 * (`<org>/<form>/fields/<fieldId>/...`) or the renderer rejects the image. Null = no logo.
 * Pure — other ids come from `newId` so tests can make them deterministic. */
export function buildPreheaderFields(
  preheader: OrgPreheader,
  logo: { fieldId: string; storageKey: string } | null | undefined,
  newId: () => string = () => crypto.randomUUID(),
): BuiltPreheader {
  const fields: Record<string, FormField> = {};
  const order: string[] = [];
  const bg = preheader.backgroundColor;
  const hasText = !isBodyEmpty(preheader.body);
  const hasLogo = Boolean(logo);
  const stacked = preheader.layout === 'stacked';

  const textId = hasText ? newId() : null;
  const logoId = logo?.fieldId ?? null;

  if (textId) {
    fields[textId] = {
      id: textId,
      type: 'static_text',
      required: false,
      body: preheader.body,
      bodyAlign: stacked
        ? 'center'
        : preheader.layout === 'logo-left' && hasLogo
          ? 'right'
          : 'left',
      bodyFontSize: 14,
      ...(bg ? { backgroundColor: bg } : {}),
    };
  }
  if (logoId && logo) {
    fields[logoId] = {
      id: logoId,
      type: 'image',
      label: '',
      required: false,
      imageStorageKey: logo.storageKey,
      alt: 'Organisation logo',
      align: stacked ? 'center' : preheader.layout === 'logo-right' ? 'right' : 'left',
      imageSize: preheader.logoSize,
      imageSpacing: 'none',
      ...(bg && stacked ? { backgroundColor: bg } : {}),
    };
  }

  if (!stacked && logoId && textId) {
    const rowId = newId();
    fields[rowId] = {
      id: rowId,
      type: 'column_layout',
      label: 'Pre-header',
      required: false,
      columns: 2,
      fieldIds: preheader.layout === 'logo-left' ? [logoId, textId] : [textId, logoId],
      ...(bg ? { backgroundColor: bg } : {}),
    };
    order.push(rowId);
  } else {
    if (logoId) order.push(logoId);
    if (textId) order.push(textId);
  }

  if (preheader.showDivider && order.length > 0) {
    const dividerId = newId();
    fields[dividerId] = { id: dividerId, type: 'divider', required: false };
    order.push(dividerId);
  }

  return { fields, order };
}
