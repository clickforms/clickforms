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

/** Rich-text default body for the Share modal's email editor
 * (src/app/forms/[id]/form-share-modal.tsx) — this is also what a builder sees prefilled
 * there, and what actually gets sent if they never touch it. Written as a short,
 * professional note (greeting, context, call to action) rather than a single terse
 * sentence, since it's going out under the builder's name to an external respondent. */
export function formShareEmailDefaultMessage(params: {
  senderName: string;
  formName: string;
}): string {
  return `<p style="text-align: center">Hello,</p><p style="text-align: center">${escapeHtml(params.senderName)} has invited you to complete the form &quot;${escapeHtml(params.formName)}&quot;.</p><p style="text-align: center">Please click the button below to get started.</p>`;
}

/** "Send via email" action in the live-form Share panel (POST /api/forms/[id]/share,
 * src/app/forms/[id]/form-share-modal.tsx) — a builder sending the public link directly
 * to a respondent, distinct from inviteEmail() above which is for adding a teammate to
 * the org itself. `senderName` comes from the sending session server-side, never client
 * input, so this can't be used to spoof a message as coming from someone else.
 *
 * The message (the builder's own edit of the modal's "Message" box, or
 * formShareEmailDefaultMessage() if they never touched it) renders as plain body copy.
 * It's untrusted user input, so only allowlisted tags, attributes and CSS survive the
 * server-side sanitizer below. The centered CTA rendered by
 * renderEmailLayout always carries the real link, so an edited message can never
 * accidentally drop it. */
export function formShareEmail(params: {
  senderName: string;
  formName: string;
  formUrl: string;
  message?: string;
}): RenderedEmail {
  const finalMessage = sanitizeEmailMessageHtml(
    params.message?.trim() || formShareEmailDefaultMessage(params),
  );

  const { html, text } = renderEmailLayout({
    preheader: `${params.senderName} sent you a form to complete: ${params.formName}.`,
    heading: "You've been invited to complete a form",
    headingAlign: 'center',
    paragraphs: [],
    messageCallout: finalMessage,
    cta: { label: 'Open form', url: params.formUrl },
  });

  return {
    subject: `${params.senderName} sent you a form to complete: ${params.formName}`,
    html,
    text,
  };
}

const EMAIL_MESSAGE_TAGS = new Set([
  'p',
  'br',
  'strong',
  'b',
  'em',
  'i',
  'u',
  's',
  'ul',
  'ol',
  'li',
  'blockquote',
  'a',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'span',
  'mark',
  'sup',
  'sub',
  'hr',
  'pre',
  'code',
  'img',
  'table',
  'thead',
  'tbody',
  'tr',
  'th',
  'td',
]);

function safeEmailStyle(rawAttributes: string): string {
  const style = rawAttributes.match(/style\s*=\s*(["'])([\s\S]*?)\1/i)?.[2];
  if (!style) return '';

  const safeDeclarations: string[] = [];
  for (const declaration of style.split(';')) {
    const [rawProperty, ...rawValueParts] = declaration.split(':');
    const property = rawProperty?.trim().toLowerCase();
    const value = rawValueParts.join(':').trim();
    if (!property || !value) continue;

    if (property === 'text-align' && /^(left|center|right|justify)$/i.test(value)) {
      safeDeclarations.push(`text-align: ${value.toLowerCase()}`);
    } else if (
      (property === 'color' || property === 'background-color') &&
      /^(#[0-9a-f]{3,8}|rgba?\([\d\s,.%]+\)|transparent|inherit)$/i.test(value)
    ) {
      safeDeclarations.push(`${property}: ${value}`);
    } else if (property === 'font-size' && /^(?:[8-9]|[1-4]\d)px$/i.test(value)) {
      safeDeclarations.push(`font-size: ${value}`);
    } else if (
      property === 'font-family' &&
      /^[a-z0-9\s"',.-]+$/i.test(value) &&
      value.length <= 160
    ) {
      safeDeclarations.push(`font-family: ${value}`);
    }
  }

  return safeDeclarations.length > 0 ? ` style="${escapeHtml(safeDeclarations.join('; '))}"` : '';
}

/** Preserve the Formatted Text editor's formatting while rejecting executable or
 * arbitrary HTML. Callers can hit the share API directly, so the server cannot assume
 * every string was produced by Tiptap. */
function sanitizeEmailMessageHtml(value: string): string {
  const withoutDangerousBlocks = value.replace(
    /<(script|style|iframe|object|embed)[^>]*>[\s\S]*?<\/\1>/gi,
    '',
  );

  return withoutDangerousBlocks.replace(
    /<\/?([a-z][a-z0-9]*)([^>]*)>/gi,
    (tag, rawName: string, rawAttributes: string) => {
      const name = rawName.toLowerCase();
      if (!EMAIL_MESSAGE_TAGS.has(name)) return '';
      if (tag.startsWith('</')) return `</${name}>`;
      if (name === 'br') return '<br />';
      if (name === 'hr') {
        return `<hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 16px 0;" />`;
      }

      if (/^(p|h[1-6]|span|mark)$/.test(name)) {
        return `<${name}${safeEmailStyle(rawAttributes)}>`;
      }

      if (name === 'a') {
        const href = rawAttributes.match(/href\s*=\s*["']([^"']+)["']/i)?.[1];
        if (!href || !/^(https?:|mailto:)/i.test(href)) return '<a>';
        return `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">`;
      }

      if (name === 'img') {
        const src = rawAttributes.match(/src\s*=\s*["']([^"']+)["']/i)?.[1];
        const alt = rawAttributes.match(/alt\s*=\s*["']([^"']*)["']/i)?.[1] ?? '';
        if (!src || !/^https:\/\//i.test(src)) return '';
        return `<img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" style="display: block; max-width: 100%; height: auto; margin: 0 0 14px;" />`;
      }

      if (name === 'table') {
        return '<table role="presentation" width="100%" cellpadding="6" cellspacing="0" style="border-collapse: collapse; margin: 0 0 16px;">';
      }
      if (name === 'th' || name === 'td') {
        const colspan = rawAttributes.match(/colspan\s*=\s*["']?(\d{1,2})/i)?.[1];
        const rowspan = rawAttributes.match(/rowspan\s*=\s*["']?(\d{1,2})/i)?.[1];
        return `<${name}${colspan ? ` colspan="${colspan}"` : ''}${rowspan ? ` rowspan="${rowspan}"` : ''} style="border: 1px solid #cbd5e1; padding: 6px; text-align: left; vertical-align: top;">`;
      }
      if (name === 'pre') {
        return '<pre style="margin: 0 0 16px; padding: 12px 16px; border-radius: 6px; background: #1e1e2e; color: #cdd6f4; overflow-x: auto;">';
      }
      if (name === 'code') {
        return '<code style="font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 13px;">';
      }
      if (name === 'blockquote') {
        return '<blockquote style="margin: 0 0 16px; padding-left: 14px; border-left: 3px solid #cbd5e1; color: #6b7280;">';
      }

      return `<${name}>`;
    },
  );
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
