import { NextResponse } from 'next/server';
import { z } from 'zod';
import { InvalidRequestError, toErrorResponse } from '@/lib/api-errors';
import { prisma } from '@/lib/db';
import { uniqueSlug } from '@/lib/forms/slug';
import { hashPassword, passwordSchema } from '@/lib/users/password';

const verifySignupBodySchema = z.object({
  token: z.string().min(1),
  password: passwordSchema,
});

/**
 * Step 2 of self-service signup: consumes a verified PendingSignup row and creates
 * the real Organization + admin User. Mirrors the original single-step signup route's
 * transaction (plain `prisma.$transaction`, not `withOrgContext` — there's no
 * organization to scope by until this transaction creates one).
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const { token, password } = verifySignupBodySchema.parse(await request.json());

    const pendingSignup = await prisma.pendingSignup.findUnique({ where: { token } });
    if (!pendingSignup || pendingSignup.completedAt || pendingSignup.expiresAt < new Date()) {
      throw new InvalidRequestError('This verification link is invalid or has expired.');
    }

    const existingUser = await prisma.user.findFirst({ where: { email: pendingSignup.email } });
    if (existingUser) {
      throw new InvalidRequestError('An account with this email already exists. Sign in instead.');
    }

    const passwordHash = await hashPassword(password);

    // Subdomain is global (not per-org), unlike forms.slug — every org's public form
    // pages live at {subdomain}.{ROOT_DOMAIN}, so this reuses the same slugify/
    // uniqueSlug helpers forms use, just against the whole organizations table instead
    // of one org's forms. Auto-generated from the org name; never user-typed (per
    // product decision — a mistyped subdomain would be a support headache later).
    const existingOrganizations = await prisma.organization.findMany({
      select: { subdomain: true },
    });
    const subdomain = uniqueSlug(
      pendingSignup.organizationName,
      new Set(existingOrganizations.map((org) => org.subdomain)),
    );

    // Every self-service signup starts on a 7-day trial at Standard-level access (see
    // /pricing) — `plan` stays at its schema default ('standard') for the numeric caps
    // that grants, and `status: 'trial'` + `trialEndsAt` is what src/lib/auth.ts checks
    // at sign-in to block access once the trial lapses without a plan being assigned
    // (see the platform-admin-only /admin/billing "Change plan" control — there's no
    // self-serve upgrade path yet).
    const TRIAL_DAYS = 7;
    const trialEndsAt = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000);

    const result = await prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: {
          name: pendingSignup.organizationName,
          subdomain,
          status: 'trial',
          trialEndsAt,
        },
      });

      const user = await tx.user.create({
        data: {
          organizationId: organization.id,
          email: pendingSignup.email,
          name: `${pendingSignup.firstName} ${pendingSignup.lastName}`.trim(),
          phone: pendingSignup.phone,
          passwordHash,
          role: 'admin',
        },
      });

      await tx.pendingSignup.update({
        where: { id: pendingSignup.id },
        data: { completedAt: new Date() },
      });

      return { organization, user };
    });

    return NextResponse.json(
      { organizationId: result.organization.id, userId: result.user.id, email: result.user.email },
      { status: 201 },
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}
