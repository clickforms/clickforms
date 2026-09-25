// SMS counterpart to src/lib/emails/templates.ts. Plain text only — no layout wrapper
// needed the way emails have one, since there's no HTML/branding to render, just a
// single short message kept well under a 160-character SMS segment where possible.

/** Default SMS text — unlike the email version, this already includes the link (SMS has
 * no separate CTA button/fallback line to fall back on), so it doubles as both the
 * modal's textarea prefill AND the literal default send content. */
export function formShareSmsDefaultMessage(params: {
  senderName: string;
  formName: string;
  formUrl: string;
}): string {
  return `${params.senderName} sent you a form to complete: ${params.formName}. Open it here: ${params.formUrl}`;
}

/** "Send via SMS" action in the live-form Share panel (POST /api/forms/[id]/share,
 * src/app/forms/[id]/form-top-nav.tsx) — SMS counterpart to formShareEmail() in
 * src/lib/emails/templates.ts. `senderName` comes from the sending session server-side,
 * never client input, for the same anti-spoofing reason as the email version.
 *
 * `message`, when provided, is sent verbatim as the entire SMS body — including the
 * link, since (unlike email) there's no separate CTA to fall back on. The modal always
 * prefills its textarea with formShareSmsDefaultMessage() (which already contains the
 * link), so a builder has to actively delete it to send a linkless text; that's treated
 * as their choice rather than something to guard against server-side. */
export function formShareSms(params: {
  senderName: string;
  formName: string;
  formUrl: string;
  message?: string;
}): string {
  return params.message?.trim() || formShareSmsDefaultMessage(params);
}
