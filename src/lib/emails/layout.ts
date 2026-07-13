// Shared branded wrapper for every transactional email this app sends (signup
// verification, invites, password reset). Deliberately table-based, inline-styled HTML
// rather than the app's own CSS classes/variables — email clients (Outlook desktop in
// particular) don't run a CSS cascade the way browsers do, so the safe subset is
// tables + inline `style` attributes. Colors are copied from globals.css's
// --color-primary/--color-text/--color-border rather than referencing the variables
// themselves, for the same reason.

const BRAND_GREEN = '#00a960';
const TEXT_DARK = '#111827';
const TEXT_MUTED = '#6b7280';
const BORDER = '#e2e8f0';
const BG = '#eef1f6';

export interface EmailLayoutParams {
  /** Short summary shown in inbox previews before the email is opened. */
  preheader: string;
  heading: string;
  /** Paragraphs of body copy, rendered in order — kept as an array so callers don't hand-write <p> tags. */
  paragraphs: string[];
  cta?: { label: string; url: string };
  /** Extra fine-print shown below the CTA in a muted, smaller font (e.g. "link expires in..."). */
  footnote?: string;
}

/** Renders both the HTML and plain-text bodies for a transactional email in one call. */
export function renderEmailLayout({
  preheader,
  heading,
  paragraphs,
  cta,
  footnote,
}: EmailLayoutParams): { html: string; text: string } {
  const bodyHtml = paragraphs.map((paragraph) => `<p style="${P_STYLE}">${paragraph}</p>`).join('\n');

  const ctaHtml = cta
    ? `
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 28px 0;">
        <tr>
          <td style="border-radius: 8px; background-color: ${BRAND_GREEN};">
            <a href="${cta.url}" style="display: inline-block; padding: 12px 24px; font-size: 15px; font-weight: 600; color: #ffffff; text-decoration: none; border-radius: 8px;">
              ${cta.label}
            </a>
          </td>
        </tr>
      </table>
      <p style="${P_STYLE} font-size: 13px; color: ${TEXT_MUTED};">
        Or paste this link into your browser:<br />
        <a href="${cta.url}" style="color: ${BRAND_GREEN}; word-break: break-all;">${cta.url}</a>
      </p>`
    : '';

  const footnoteHtml = footnote
    ? `<p style="${P_STYLE} font-size: 13px; color: ${TEXT_MUTED};">${footnote}</p>`
    : '';

  const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${heading}</title>
  </head>
  <body style="margin: 0; padding: 0; background-color: ${BG}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
    <span style="display: none; max-height: 0; overflow: hidden; opacity: 0;">${preheader}</span>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: ${BG}; padding: 32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width: 480px; width: 100%; background-color: #ffffff; border: 1px solid ${BORDER}; border-radius: 12px; overflow: hidden;">
            <tr>
              <td style="padding: 28px 32px 8px; border-bottom: 1px solid ${BORDER};">
                <table role="presentation" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding-right: 8px;">
                      <table role="presentation" width="24" height="24" cellpadding="0" cellspacing="0" style="background-color: ${BRAND_GREEN}; border-radius: 6px;">
                        <tr><td></td></tr>
                      </table>
                    </td>
                    <td style="font-size: 16px; font-weight: 700; color: ${TEXT_DARK};">Clickforms</td>
                  </tr>
                </table>
                <div style="height: 12px;"></div>
              </td>
            </tr>
            <tr>
              <td style="padding: 28px 32px 32px;">
                <h1 style="margin: 0 0 16px; font-size: 20px; font-weight: 700; color: ${TEXT_DARK};">${heading}</h1>
                ${bodyHtml}
                ${ctaHtml}
                ${footnoteHtml}
              </td>
            </tr>
          </table>
          <p style="margin: 20px 0 0; font-size: 12px; color: ${TEXT_MUTED};">Clickforms &middot; Internal forms platform</p>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const textLines = [
    heading,
    '',
    ...paragraphs.map(stripHtml),
    ...(cta ? ['', `${cta.label}: ${cta.url}`] : []),
    ...(footnote ? ['', stripHtml(footnote)] : []),
  ];

  return { html, text: textLines.join('\n') };
}

const P_STYLE = 'margin: 0 0 16px; font-size: 15px; line-height: 1.5; color: #374151;';

/** Best-effort HTML → plain text for the small set of tags these templates actually use (<strong>, <a>). */
function stripHtml(value: string): string {
  return value
    .replace(/<a href="([^"]+)">[^<]*<\/a>/g, '$1')
    .replace(/<\/?strong>/g, '')
    .replace(/<[^>]+>/g, '');
}
