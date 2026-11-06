import { describe, expect, it } from 'vitest';
import { isPreheaderEmpty, parsePreheader, preheaderInfoHtml } from '@/lib/org-preheader';

describe('parsePreheader', () => {
  it('accepts a valid value and rejects junk', () => {
    expect(parsePreheader({ showLogo: true, title: 'A', details: 'b' })).toEqual({
      showLogo: true,
      title: 'A',
      details: 'b',
    });
    expect(parsePreheader(null)).toBeNull();
    expect(parsePreheader({ showLogo: 'yes' })).toBeNull();
  });
});

describe('isPreheaderEmpty', () => {
  it('is empty without content, or with only a logo that does not exist', () => {
    expect(isPreheaderEmpty(null, true)).toBe(true);
    expect(isPreheaderEmpty({ showLogo: true, title: '', details: '' }, false)).toBe(true);
    expect(isPreheaderEmpty({ showLogo: true, title: '', details: '' }, true)).toBe(false);
    expect(isPreheaderEmpty({ showLogo: false, title: 'X', details: '' }, false)).toBe(false);
  });
});

describe('preheaderInfoHtml', () => {
  it('bolds the title, one paragraph per line, and escapes HTML', () => {
    const html = preheaderInfoHtml({
      showLogo: false,
      title: 'Acme <b>',
      details: 'ABN 1\n\n  1 St & Co  ',
    });
    expect(html).toBe('<p><strong>Acme &lt;b&gt;</strong></p><p>ABN 1</p><p>1 St &amp; Co</p>');
  });
});
