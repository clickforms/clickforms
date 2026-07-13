import { NextResponse } from 'next/server';
import { z } from 'zod';
import { toErrorResponse } from '@/lib/api-errors';
import { prisma } from '@/lib/db';
import { sendEmail } from '@/lib/email';
import { signupVerificationEmail } from '@/lib/emails/templates';
import { signupVerifyUrl } from '@/lib/users/signup-verify-url';

const signupBodySchema = z.object({
  organizationName: z.string().trim().min(1, 'Organisation name is required').max(200),
  firstName: z.string().trim().min(1, 'First name is required').max(200),
  lastName: z.string().trim().min(1, 'Last name is required').max(200),
  email: z.string().trim().email('Enter a valid email'),
  phone: z.string().trim().min(1, 'Phone number is required').max(50),
  formSituation: z.enum(['paper_form', 'existing_online_form', 'no_form'], {
    message: 'Select which of the following most applies to you',
  }),
  termsAccepted: z.literal(true, { message: 'You must agree to the Terms of Use to continue' }),
});

const PENDING_SIGNUP_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Step 1 of self-service signup: captures org/contact details and emails a
 * verification link, but does NOT create an Organization/User yet — that only
 * happens once the link is clicked and a password is set (POST
 * /api/auth/signup/verify). See PendingSignup in schema.prisma.
 *
 * Always returns a generic success response regardless of whether the email
 * address was already taken, so this endpoint can't be used to enumerate
 * existing accounts.
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = signupBodySchema.parse(await request.json());
    const email = body.email.toLowerCase();

    const existingUser = await prisma.user.findFirst({ where: { email } });
    if (existingUser) {
      // Don't reveal via a distinct error that this email is taken — silently no-op
      // (no pending row written, no email sent) and return the same success shape.
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + PENDING_SIGNUP_TTL_MS);

    await prisma.pendingSignup.upsert({
      where: { email },
      create: {
        organizationName: body.organizationName.trim(),
        firstName: body.firstName.trim(),
        lastName: body.lastName.trim(),
        email,
        phone: body.phone.trim(),
        formSituation: body.formSituation,
        termsAcceptedAt: new Date(),
        token,
        expiresAt,
      },
      update: {
        organizationName: body.organizationName.trim(),
        firstName: body.firstName.trim(),
        lastName: body.lastName.trim(),
        phone: body.phone.trim(),
        formSituation: body.formSituation,
        termsAcceptedAt: new Date(),
        token,
        expiresAt,
        completedAt: null,
      },
    });

    const verifyUrl = signupVerifyUrl(token);
    const rendered = signupVerificationEmail({
      firstName: body.firstName.trim(),
      organizationName: body.organizationName.trim(),
      verifyUrl,
    });

    await sendEmail({ to: email, subject: rendered.subject, html: rendered.html, text: rendered.text });

    // Dev-mode convenience: when SMTP isn't configured, sendEmail() only logs the
    // message server-side — surface the link in the response too so local testing
    // doesn't require reading server logs. Never included once SMTP is configured.
    if (!process.env.SMTP_HOST) {
      return NextResponse.json({ ok: true, devVerifyUrl: verifyUrl }, { status: 200 });
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
