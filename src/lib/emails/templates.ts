import type { UserRole } from '@prisma/client';
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

/** "Forgot password" flow (POST /api/auth/forgot-password) — reset link for an existing user. */
export function passwordResetEmail(params: { name: string; resetUrl: string }): RenderedEmail {
  const { html, text } = renderEmailLayout({
    preheader: 'Reset your Clickforms password.',
    heading: 'Reset your password',
    paragraphs: [
      `Hi ${params.name},`,
      'We got a request to reset your Clickforms password. Click the button below to choose a new one.',
    ],
    cta: { label: 'Reset password', url: params.resetUrl },
    footnote:
      "This link expires in 1 hour. If you didn't request a password reset, you can safely ignore this email — your password won't be changed.",
  });

  return { subject: 'Reset your Clickforms password', html, text };
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
