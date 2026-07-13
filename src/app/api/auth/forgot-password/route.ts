import { NextResponse } from 'next/server';
import { z } from 'zod';
import { toErrorResponse } from '@/lib/api-errors';
import { prisma } from '@/lib/db';
import { sendEmail } from '@/lib/email';
import { passwordResetEmail } from '@/lib/emails/templates';
import { resetPasswordUrl } from '@/lib/users/reset-password-url';

const forgotPasswordBodySchema = z.object({
  email: z.string().trim().email('Enter a valid email'),
});

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour — much shorter than the 24h signup/invite
// links, since this one grants a password change on an *existing* account rather than
// just continuing a signup.

/**
 * Requests a password-reset email. Always returns the same generic success response
 * regardless of whether the address matches an account — same anti-enumeration
 * convention as POST /api/auth/signup. No session required; this is how a locked-out
 * user gets back in.
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const { email } = forgotPasswordBodySchema.parse(await request.json());
    const normalizedEmail = email.toLowerCase();

    // Pre-org-context lookup, same exception as the credentials provider in auth.ts:
    // we don't know the org until we've found the user by email.
    const user = await prisma.user.findFirst({ where: { email: normalizedEmail } });

    if (!user) {
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    // Drop any earlier unused tokens for this user so only the most recently requested
    // link works — otherwise an old, still-emailed link would remain valid alongside a
    // new one.
    await prisma.passwordResetToken.deleteMany({ where: { userId: user.id, usedAt: null } });

    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);

    await prisma.passwordResetToken.create({
      data: { userId: user.id, token, expiresAt },
    });

    const resetUrl = resetPasswordUrl(token);
    const rendered = passwordResetEmail({ name: user.name ?? user.email, resetUrl });

    await sendEmail({
      to: user.email,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
    });

    // Dev-mode convenience, same as signup: surface the link in the response when SMTP
    // isn't configured so local testing doesn't require reading server logs.
    if (!process.env.SMTP_HOST) {
      return NextResponse.json({ ok: true, devResetUrl: resetUrl }, { status: 200 });
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
