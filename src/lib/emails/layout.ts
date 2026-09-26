// Shared branded wrapper for every transactional email this app sends (signup
// verification, invites, password reset). Deliberately table-based, inline-styled HTML
// rather than the app's own CSS classes/variables — email clients (Outlook desktop in
// particular) don't run a CSS cascade the way browsers do, so the safe subset is
// tables + inline `style` attributes. Colors are copied from globals.css's
// --color-primary/--color-text/--color-border rather than referencing the variables
// themselves, for the same reason.

const BRAND_GREEN = '#55ea8c';
const BRAND_GREEN_DARK = '#3dd975';
const LAVENDER = '#7c5cfa';
const LAVENDER_SOFT = '#efecff';
const TEXT_DARK = '#111827';
const TEXT_MUTED = '#6b7280';
const BORDER = '#e2e8f0';
const BG = '#eef1f6';
const BRAND_LOGO_URL = 'https://clickforms.com.au/brand/logo.png';

export interface EmailLayoutParams {
  /** Short summary shown in inbox previews before the email is opened. */
  preheader: string;
  heading: string;
  headingAlign?: 'left' | 'center';
  /** Paragraphs of body copy, rendered in order — kept as an array so callers don't hand-write <p> tags. */
  paragraphs: string[];
  /** A sender-authored message rendered plainly between `paragraphs` and the CTA.
   * Supports `<br />` line breaks; anything else must already be escaped by the caller. */
  messageCallout?: string;
  cta?: { label: string; url: string };
  /** Extra fine-print shown below the CTA in a muted, smaller font (e.g. "link expires in..."). */
  footnote?: string;
}

/** Renders both the HTML and plain-text bodies for a transactional email in one call. */
export function renderEmailLayout({
  preheader,
  heading,
  headingAlign = 'left',
  paragraphs,
  messageCallout,
  cta,
  footnote,
}: EmailLayoutParams): { html: string; text: string } {
  const bodyHtml = paragraphs
    .map((paragraph) => `<p style="${P_STYLE}">${paragraph}</p>`)
    .join('\n');

  const messageCalloutHtml = messageCallout
    ? `<div style="margin: 2px 0 22px; font-size: 15px; line-height: 1.6; color: ${TEXT_DARK};">
        ${messageCallout}
      </div>`
    : '';

  const ctaHtml = cta
    ? `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 28px 0;">
        <tr>
          <td align="center">
            <table role="presentation" cellpadding="0" cellspacing="0">
              <tr>
                <td style="border-radius: 8px; background-color: ${BRAND_GREEN_DARK};">
                  <a href="${cta.url}" style="display: inline-block; padding: 12px 28px; font-size: 15px; font-weight: 600; color: #ffffff; text-decoration: none; border-radius: 8px;">
                    ${cta.label}
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>`
    : '';

  // A tinted callout rather than plain muted text — the lavender brand accent gives
  // security/expiry notices ("this link expires in...") a bit more visual weight than
  // the rest of the body copy without competing with the green CTA button above it.
  const footnoteHtml = footnote
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 4px 0 0;">
        <tr>
          <td style="background-color: ${LAVENDER_SOFT}; border-radius: 8px; padding: 12px 16px; font-size: 13px; line-height: 1.5; color: ${LAVENDER};">
            ${footnote}
          </td>
        </tr>
      </table>`
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
              <td style="line-height: 0; font-size: 0;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td width="50%" height="4" style="background-color: ${BRAND_GREEN};">&nbsp;</td>
                    <td width="50%" height="4" style="background-color: ${LAVENDER};">&nbsp;</td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding: 24px 32px; border-bottom: 1px solid ${BORDER};">
                <img
                  src="${BRAND_LOGO_URL}"
                  width="120"
                  alt="Clickforms"
                  style="display: block; width: 120px; height: auto; border: 0;"
                />
              </td>
            </tr>
            <tr>
              <td style="padding: 28px 32px 32px;">
                <h1 style="margin: 0 0 16px; font-size: 20px; font-weight: 700; color: ${TEXT_DARK}; text-align: ${headingAlign};">${heading}</h1>
                ${bodyHtml}
                ${messageCalloutHtml}
                ${ctaHtml}
                ${footnoteHtml}
              </td>
            </tr>
          </table>
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width: 480px; width: 100%; margin-top: 20px;">
            <tr>
              <td align="center" style="font-size: 12px; line-height: 1.6; color: ${TEXT_MUTED};">
                <strong style="color: ${TEXT_DARK};">Clickforms</strong> &middot; Forms, built for your team<br />
                <span style="font-size: 11px; color: #9ca3af;">
                  This email was sent using Clickforms. If you weren't expecting it, you can safely ignore it.
                </span>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const textLines = [
    heading,
    '',
    ...paragraphs.map(stripHtml),
    ...(messageCallout ? [stripHtml(messageCallout), ''] : []),
    ...(cta ? [`${cta.label}: ${cta.url}`] : []),
    ...(footnote ? ['', stripHtml(footnote)] : []),
  ];

  return { html, text: textLines.join('\n') };
}

const P_STYLE = 'margin: 0 0 16px; font-size: 15px; line-height: 1.5; color: #374151;';

/** Best-effort HTML → plain text for the small set of tags these templates actually use
 * (<strong>, <a>, <br />). <br /> becomes a real newline first so a multi-line
 * messageCallout doesn't collapse onto one line once the rest of the tags are stripped. */
function stripHtml(value: string): string {
  return value
    .replace(/<a href="([^"]+)">[^<]*<\/a>/g, '$1')
    .replace(/<br\s*\/?>/g, '\n')
    .replace(/<\/(?:p|div|h[1-6]|blockquote)>/g, '\n')
    .replace(/<li[^>]*>/g, '• ')
    .replace(/<\/li>/g, '\n')
    .replace(/<\/?strong>/g, '')
    .replace(/<[^>]+>/g, '');
}
