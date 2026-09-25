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

export interface EmailLayoutParams {
  /** Short summary shown in inbox previews before the email is opened. */
  preheader: string;
  heading: string;
  /** Paragraphs of body copy, rendered in order — kept as an array so callers don't hand-write <p> tags. */
  paragraphs: string[];
  /** A distinct bordered card (light background, lavender left-accent) rendered between
   * `paragraphs` and the CTA — for content that reads as a message from a specific
   * person rather than boilerplate copy (see formShareEmail's use of it for the
   * builder's own note). Supports `<br />` line breaks; anything else must already be
   * escaped by the caller. Omit for templates that don't need this distinction. */
  messageCallout?: string;
  cta?: { label: string; url: string };
  /** Extra fine-print shown below the CTA in a muted, smaller font (e.g. "link expires in..."). */
  footnote?: string;
}

/** Renders both the HTML and plain-text bodies for a transactional email in one call. */
export function renderEmailLayout({
  preheader,
  heading,
  paragraphs,
  messageCallout,
  cta,
  footnote,
}: EmailLayoutParams): { html: string; text: string } {
  const bodyHtml = paragraphs
    .map((paragraph) => `<p style="${P_STYLE}">${paragraph}</p>`)
    .join('\n');

  // Light card with a lavender left-accent border rather than the tinted footnote
  // treatment below — that one means "system notice" (expiry, security), this one means
  // "a person wrote this", so they're deliberately styled differently.
  const messageCalloutHtml = messageCallout
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 2px 0 22px;">
        <tr>
          <td style="background-color: #f8fafc; border: 1px solid ${BORDER}; border-left: 3px solid ${LAVENDER}; border-radius: 8px; padding: 14px 18px; font-size: 14.5px; line-height: 1.6; color: ${TEXT_DARK};">
            ${messageCallout}
          </td>
        </tr>
      </table>`
    : '';

  const ctaHtml = cta
    ? `
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 28px 0;">
        <tr>
          <td style="border-radius: 8px; background-color: ${BRAND_GREEN_DARK};">
            <a href="${cta.url}" style="display: inline-block; padding: 12px 26px; font-size: 15px; font-weight: 600; color: #ffffff; text-decoration: none; border-radius: 8px;">
              ${cta.label}
            </a>
          </td>
        </tr>
      </table>
      <p style="${P_STYLE} font-size: 13px; color: ${TEXT_MUTED};">
        Or paste this link into your browser:<br />
        <a href="${cta.url}" style="color: ${BRAND_GREEN_DARK}; word-break: break-all;">${cta.url}</a>
      </p>`
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
              <td style="padding: 24px 32px 8px; border-bottom: 1px solid ${BORDER};">
                <table role="presentation" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding-right: 8px; vertical-align: middle;">
                      <table role="presentation" width="28" height="28" cellpadding="0" cellspacing="0" style="background-color: ${BRAND_GREEN_DARK}; border-radius: 7px;">
                        <tr>
                          <td align="center" style="padding: 6px 5px;">
                            <div style="height: 2px; background: #fff; border-radius: 1px; margin: 0 0 3px;"></div>
                            <div style="height: 2px; width: 60%; background: #fff; border-radius: 1px; margin: 0 0 3px;"></div>
                            <div style="height: 2px; background: #fff; border-radius: 1px;"></div>
                          </td>
                        </tr>
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
                This is an automated message from Clickforms.
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
    .replace(/<\/?strong>/g, '')
    .replace(/<[^>]+>/g, '');
}
