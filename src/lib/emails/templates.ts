import type { PlatformAdminRole, UserRole } from '@prisma/client';
import { renderEmailLayout } from '@/lib/emails/layout';

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

/** Step 1 of self-service signup (POST /api/auth/signup) — verify email, then set a password. */
export function signupVerificationEmail(params: {
  firstName: string;
  organizationName: string;
  verifyUrl: string;
}): RenderedEmail {
  const { html, text } = renderEmailLayout({
    preheader: `Verify your email to finish setting up ${params.organizationName}'s Clickforms workspace.`,
    heading: 'Verify your email',
    paragraphs: [
      `Hi ${params.firstName},`,
      `Click the button below to verify your email and set a password for <strong>${params.organizationName}</strong>'s Clickforms workspace.`,
    ],
    cta: { label: 'Verify email & set password', url: params.verifyUrl },
    footnote:
      "This link expires in 24 hours. If you didn't request this, you can ignore this email.",
  });

  return { subject: 'Verify your email to finish setting up Clickforms', html, text };
}

/** A new org member's invite link (POST /api/users) — join an existing org's workspace. */
export function inviteEmail(params: {
  name: string;
  organizationName: string;
  role: UserRole;
  invitedByName: string;
  inviteUrl: string;
}): RenderedEmail {
  const { html, text } = renderEmailLayout({
    preheader: `${params.invitedByName} invited you to join ${params.organizationName} on Clickforms.`,
    heading: "You've been invited",
    paragraphs: [
      `Hi ${params.name},`,
      `<strong>${params.invitedByName}</strong> invited you to join <strong>${params.organizationName}</strong>'s Clickforms workspace as ${roleLabel(params.role)}.`,
    ],
    cta: { label: 'Accept invite & set password', url: params.inviteUrl },
    footnote:
      "This link expires in 7 days. If you weren't expecting this, you can ignore this email.",
  });

  return {
    subject: `You've been invited to join ${params.organizationName} on Clickforms`,
    html,
    text,
  };
}

/**
 * "Forgot password" flow (POST /api/auth/forgot-password) — reset link for an existing
 * user. `organizationName` is passed whenever the requesting email matches more than one
 * account (the same email can be a separate User row in several organisations — see
 * User's @@unique([organizationId, email])) so each email names which org's account its
 * link resets, rather than sending several identical-looking emails with no way to tell
 * them apart.
 */
export function passwordResetEmail(params: {
  name: string;
  resetUrl: string;
  organizationName?: string | null;
}): RenderedEmail {
  const { html, text } = renderEmailLayout({
    preheader: 'Reset your Clickforms password.',
    heading: 'Reset your password',
    paragraphs: [
      `Hi ${params.name},`,
      params.organizationName
        ? `We got a request to reset your Clickforms password for <strong>${params.organizationName}</strong>. Click the button below to choose a new one for that organisation.`
        : 'We got a request to reset your Clickforms password. Click the button below to choose a new one.',
    ],
    cta: { label: 'Reset password', url: params.resetUrl },
    footnote:
      "This link expires in 1 hour. If you didn't request a password reset, you can safely ignore this email — your password won't be changed.",
  });

  return { subject: 'Reset your Clickforms password', html, text };
}

/** New-response alert, fired from PATCH /api/f/[slug]/submissions/[submissionId] once a
 * respondent finishes submitting — see src/lib/forms/submission-notification.ts for who
 * it's sent to (org default vs. per-form override vs. off) and the PDF it's attached
 * with. `respondentHint` is a best-effort label (e.g. a "Name" field's answer) rather
 * than anything guaranteed present — plenty of forms have no such field, or the
 * respondent left it blank. */
export function submissionNotificationEmail(params: {
  formName: string;
  submittedAt: Date;
  viewUrl: string;
  respondentHint?: string | null;
}): RenderedEmail {
  const submittedLabel = params.submittedAt.toLocaleString('en-AU', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  const { html, text } = renderEmailLayout({
    preheader: `A new response was submitted to ${params.formName}.`,
    heading: 'New form response',
    paragraphs: [
      `<strong>${params.formName}</strong> just received a new response${
        params.respondentHint ? ` from <strong>${params.respondentHint}</strong>` : ''
      }, submitted ${submittedLabel}.`,
      'A PDF copy of the response is attached to this email.',
    ],
    cta: { label: 'View response', url: params.viewUrl },
  });

  return { subject: `New response: ${params.formName}`, html, text };
}

/** Marketing site's public contact form (POST /api/contact) — sent to the internal
 * support inbox, not to the visitor. sendEmail() is called with replyTo set to the
 * visitor's own address so a reply goes straight to them. */
export function contactFormEmail(params: {
  fullName: string;
  email: string;
  phone?: string;
  concern: string;
  description: string;
  attachmentFilename?: string | null;
}): RenderedEmail {
  const { html, text } = renderEmailLayout({
    preheader: `New ${params.concern.toLowerCase()} message from ${params.fullName} via the Clickforms contact form.`,
    heading: 'New contact form submission',
    paragraphs: [
      `<strong>${params.fullName}</strong> (${params.email}${params.phone ? `, ${params.phone}` : ''}) sent a <strong>${params.concern}</strong> message through the website:`,
      params.description.replace(/\n/g, '<br />'),
      params.attachmentFilename ? `Attached: <strong>${params.attachmentFilename}</strong>` : '',
    ].filter(Boolean),
    footnote: `Reply to this email to respond directly to ${params.email}.`,
  });

  return { subject: `Contact form: ${params.concern} from ${params.fullName}`, html, text };
}

/** Plain-text default body for the Share modal's editable message box
 * (src/app/forms/[id]/form-share-modal.tsx) — this is also what a builder sees prefilled
 * there, and what actually gets sent if they never touch it. Written as a short,
 * professional note (greeting, context, call to action) rather than a single terse
 * sentence, since it's going out under the builder's name to an external respondent. */
export function formShareEmailDefaultMessage(params: {
  senderName: string;
  formName: string;
}): string {
  return `Hello,\n\n${params.senderName} has invited you to complete the form "${params.formName}". Please click the button below to get started.`;
}

/** "Send via email" action in the live-form Share panel (POST /api/forms/[id]/share,
 * src/app/forms/[id]/form-share-modal.tsx) — a builder sending the public link directly
 * to a respondent, distinct from inviteEmail() above which is for adding a teammate to
 * the org itself. `senderName` comes from the sending session server-side, never client
 * input, so this can't be used to spoof a message as coming from someone else.
 *
 * The message (the builder's own edit of the modal's "Message" box, or
 * formShareEmailDefaultMessage() if they never touched it) renders in its own bordered
 * callout card rather than as a plain paragraph — the same "personal note, separate from
 * the boilerplate" treatment share emails from Dropbox/Google Drive use — so it reads as
 * a message from the sender rather than another line of system copy. It's untrusted user
 * input, so it's HTML-escaped before being interpolated. The CTA button and its
 * plain-URL fallback (rendered by renderEmailLayout independently of the callout) always
 * carry the real link, so an edited message can never accidentally drop it. */
export function formShareEmail(params: {
  senderName: string;
  formName: string;
  formUrl: string;
  message?: string;
}): RenderedEmail {
  const finalMessage = params.message?.trim() || formShareEmailDefaultMessage(params);

  const { html, text } = renderEmailLayout({
    preheader: `${params.senderName} sent you a form to complete: ${params.formName}.`,
    heading: "You've been invited to complete a form",
    paragraphs: [],
    messageCallout: escapeHtml(finalMessage).replace(/\n/g, '<br />'),
    cta: { label: 'Open form', url: params.formUrl },
  });

  return {
    subject: `${params.senderName} sent you a form to complete: ${params.formName}`,
    html,
    text,
  };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function roleLabel(role: UserRole): string {
  switch (role) {
    case 'admin':
      return 'an admin';
    case 'editor':
      return 'an editor';
    case 'viewer':
      return 'a viewer';
    default:
      return 'a member';
  }
}

/** A new /admin "Team" invite (POST /api/admin/team/invite) — joining Clickforms staff,
 * not a customer organisation, so this deliberately doesn't mention any org name. */
export function platformAdminInviteEmail(params: {
  name: string;
  role: PlatformAdminRole;
  invitedByName: string;
  inviteUrl: string;
}): RenderedEmail {
  const roleText = params.role === 'super_admin' ? 'a super admin' : 'support (read-only)';
  const { html, text } = renderEmailLayout({
    preheader: `${params.invitedByName} invited you to join the Clickforms Admin team.`,
    heading: "You've been invited to Clickforms Admin",
    paragraphs: [
      `Hi ${params.name},`,
      `<strong>${params.invitedByName}</strong> invited you to join the Clickforms platform staff team as ${roleText}.`,
    ],
    cta: { label: 'Accept invite & set password', url: params.inviteUrl },
    footnote:
      "This link expires in 7 days. If you weren't expecting this, you can ignore this email.",
  });

  return { subject: "You've been invited to Clickforms Admin", html, text };
}
