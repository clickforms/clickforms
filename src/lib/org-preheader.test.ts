import { describe, expect, it } from 'vitest';
import {
  buildPreheaderFields,
  isBodyEmpty,
  isPreheaderEmpty,
  parsePreheader,
  resolvePreheaderLogoKey,
} from '@/lib/org-preheader';

const base = {
  showLogo: true,
  layout: 'logo-left' as const,
  logoSize: 'medium' as const,
  body: '<p>Acme</p>',
  showDivider: false,
};

const LOGO = { fieldId: 'logo1', storageKey: 'org/form/fields/logo1/x.png' };

function ids() {
  let n = 0;
  return () => `id${++n}`;
}

describe('parsePreheader', () => {
  it('accepts a valid value, applies defaults, rejects junk', () => {
    expect(parsePreheader({ showLogo: true, body: '<p>x</p>' })).toMatchObject({
      layout: 'logo-left',
      logoSize: 'medium',
      showDivider: false,
    });
    expect(parsePreheader(null)).toBeNull();
    expect(parsePreheader({ showLogo: 'yes' })).toBeNull();
    expect(parsePreheader({ ...base, backgroundColor: 'red' })).toBeNull();
  });

  it('migrates the legacy title/details shape and escapes HTML', () => {
    const migrated = parsePreheader({
      showLogo: true,
      title: 'Acme <b>',
      details: 'ABN 1\n\n 1 St & Co ',
    });
    expect(migrated?.body).toBe(
      '<p><strong>Acme &lt;b&gt;</strong></p><p>ABN 1</p><p>1 St &amp; Co</p>',
    );
  });
});

describe('emptiness', () => {
  it('treats tag-only bodies as empty', () => {
    expect(isBodyEmpty('<p></p><p>&nbsp;</p>')).toBe(true);
    expect(isBodyEmpty('<p>Hi</p>')).toBe(false);
  });
  it('is empty without text, or with a logo that does not exist', () => {
    expect(isPreheaderEmpty(null, true)).toBe(true);
    expect(isPreheaderEmpty({ ...base, body: '<p></p>' }, false)).toBe(true);
    expect(isPreheaderEmpty({ ...base, body: '<p></p>' }, true)).toBe(false);
  });
});

describe('resolvePreheaderLogoKey', () => {
  it('prefers the pre-header upload, falls back to the org logo, honours showLogo', () => {
    expect(resolvePreheaderLogoKey({ ...base, logoStorageKey: 'a' }, 'b')).toBe('a');
    expect(resolvePreheaderLogoKey(base, 'b')).toBe('b');
    expect(resolvePreheaderLogoKey({ ...base, showLogo: false }, 'b')).toBeNull();
  });
});

describe('buildPreheaderFields', () => {
  it('logo-left builds a two-column row with the logo first', () => {
    const { fields, order } = buildPreheaderFields(base, LOGO, ids());
    expect(order).toHaveLength(1);
    const row = fields[order[0] as string];
    expect(row?.type).toBe('column_layout');
    if (row?.type === 'column_layout') {
      expect(fields[row.fieldIds[0] as string]?.type).toBe('image');
      expect(fields[row.fieldIds[1] as string]?.type).toBe('static_text');
    }
  });

  it('logo-right puts the text first', () => {
    const { fields, order } = buildPreheaderFields({ ...base, layout: 'logo-right' }, LOGO, ids());
    const row = fields[order[0] as string];
    if (row?.type === 'column_layout') {
      expect(fields[row.fieldIds[0] as string]?.type).toBe('static_text');
    }
  });

  it('stacked emits separate centred fields, plus a divider when asked', () => {
    const { fields, order } = buildPreheaderFields(
      { ...base, layout: 'stacked', showDivider: true, backgroundColor: '#ffffff' },
      LOGO,
      ids(),
    );
    expect(order.map((id) => fields[id]?.type)).toEqual(['image', 'static_text', 'divider']);
  });

  it('omits the logo or text when absent and returns nothing when both are', () => {
    expect(buildPreheaderFields(base, null, ids()).order.map((id) => id)).toHaveLength(1);
    expect(buildPreheaderFields({ ...base, body: '' }, null, ids()).order).toHaveLength(0);
  });
});
