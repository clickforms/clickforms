import { prisma } from '@/lib/db';
import { sendEmail } from '@/lib/email';
import { passwordResetEmail } from '@/lib/emails/templates';
import { resetPasswordUrl } from '@/lib/users/reset-password-url';

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

/**
 * Issues a one-hour password-reset token, emails the user, and returns the public
 * reset URL. Shared by self-serve forgot-password and the platform-admin "Reset
 * password" action on /admin/users.
 *
 * `organizationName` is optional and purely cosmetic (names the org in the email body —
 * see passwordResetEmail's doc comment) — forgot-password passes it because the same
 * email can match more than one organisation's account, and the platform-admin
 * "Reset password" action always targets exactly one already-known account, so it has no
 * need to.
 */
export async function issuePasswordReset(user: {
  id: string;
  email: string;
  name: string | null;
  organizationId: string | null;
  organizationName?: string | null;
}): Promise<string> {
  await prisma.passwordResetToken.deleteMany({ where: { userId: user.id, usedAt: null } });

  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);
  await prisma.passwordResetToken.create({
    data: { userId: user.id, token, expiresAt },
  });

  const resetUrl = resetPasswordUrl(token);
  const rendered = passwordResetEmail({
    name: user.name ?? user.email,
    resetUrl,
    organizationName: user.organizationName,
  });
  await sendEmail({
    to: user.email,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
    kind: 'password_reset',
    organizationId: user.organizationId,
  });

  return resetUrl;
}
