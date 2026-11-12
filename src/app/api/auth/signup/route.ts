import { NextResponse } from 'next/server';
import { z } from 'zod';
import { toErrorResponse } from '@/lib/api-errors';
import { prisma } from '@/lib/db';
import { sendEmail } from '@/lib/email';
import { signupVerificationEmail } from '@/lib/emails/templates';
import { log } from '@/lib/log';
import { clientIp, isRateLimited } from '@/lib/rate-limit';
import { signupVerifyUrl } from '@/lib/users/signup-verify-url';
import {
  validateEmailField,
  validateNameField,
  validateOrganisationNameField,
  validatePhoneField,
} from '@/lib/validation/contact-fields';

const signupBodySchema = z.object({
  organizationName: z
    .string()
    .trim()
    .max(200)
    .superRefine((value, ctx) => {
      const message = validateOrganisationNameField(value);
      if (message) ctx.addIssue({ code: 'custom', message });
    }),
  firstName: z
    .string()
    .trim()
    .max(200)
    .superRefine((value, ctx) => {
      const message = validateNameField(value, 'First name');
      if (message) ctx.addIssue({ code: 'custom', message });
    }),
  lastName: z
    .string()
    .trim()
    .max(200)
    .superRefine((value, ctx) => {
      const message = validateNameField(value, 'Last name');
      if (message) ctx.addIssue({ code: 'custom', message });
    }),
  email: z
    .string()
    .trim()
    .superRefine((value, ctx) => {
      const message = validateEmailField(value);
      if (message) ctx.addIssue({ code: 'custom', message });
    }),
  phone: z
    .string()
    .trim()
    .max(50)
    .superRefine((value, ctx) => {
      const message = validatePhoneField(value);
      if (message) ctx.addIssue({ code: 'custom', message });
    }),
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
 * An address that already has an account is told so plainly (HTTP 409, code
 * "account_exists") so the person can sign in or reset their password instead of
 * waiting for an email that will never come — the same choice Google and Amazon make.
 * The cost is that the form can reveal whether an address is registered, so it is
 * rate-limited per client address to make bulk probing impractical.
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    if (isRateLimited(`signup:${clientIp(request)}`, 10, 15 * 60 * 1000)) {
      log.warn('auth.signup_rate_limited', { ip: clientIp(request) });
      return NextResponse.json(
        { error: 'Too many attempts. Please wait a few minutes and try again.' },
        { status: 429 },
      );
    }

    const body = signupBodySchema.parse(await request.json());
    const email = body.email.toLowerCase();

    const existingUser = await prisma.user.findFirst({ where: { email } });
    if (existingUser) {
      log.info('auth.signup_existing_account', { email });
      return NextResponse.json(
        {
          error: 'An account with this email address already exists.',
          code: 'account_exists',
        },
        { status: 409 },
      );
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

    await sendEmail({
      to: email,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      kind: 'signup_verification',
    });

    // Dev-mode convenience: when Resend isn't configured, sendEmail() only logs the
    // message server-side — surface the link in the response too so local testing
    // doesn't require reading server logs. Never included once RESEND_API_KEY is set.
    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json({ ok: true, devVerifyUrl: verifyUrl }, { status: 200 });
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
