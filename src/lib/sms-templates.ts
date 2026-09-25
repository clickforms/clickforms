// SMS counterpart to src/lib/emails/templates.ts. Plain text only — no layout wrapper
// needed the way emails have one, since there's no HTML/branding to render, just a
// single short message kept well under a 160-character SMS segment where possible.

/** "Send via SMS" action in the live-form Share panel (POST /api/forms/[id]/share,
 * src/app/forms/[id]/form-top-nav.tsx) — SMS counterpart to formShareEmail() in
 * src/lib/emails/templates.ts. `senderName` comes from the sending session server-side,
 * never client input, for the same anti-spoofing reason as the email version. */
export function formShareSms(params: {
  senderName: string;
  formName: string;
  formUrl: string;
}): string {
  return `${params.senderName} sent you a form to complete: ${params.formName}. Open it here: ${params.formUrl}`;
}
