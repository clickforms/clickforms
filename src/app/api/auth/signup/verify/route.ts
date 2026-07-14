import bcrypt from 'bcryptjs';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { InvalidRequestError, toErrorResponse } from '@/lib/api-errors';
import { prisma } from '@/lib/db';
import { uniqueSlug } from '@/lib/forms/slug';

const verifySignupBodySchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8, 'Password must be at least 8 characters'),
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

    const passwordHash = await bcrypt.hash(password, 12);

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

    const result = await prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: { name: pendingSignup.organizationName, subdomain },
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
