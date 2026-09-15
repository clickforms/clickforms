import { NextResponse } from 'next/server';
import { z } from 'zod';
import { toErrorResponse } from '@/lib/api-errors';
import { prisma } from '@/lib/db';
import { issuePasswordReset } from '@/lib/users/issue-password-reset';

const forgotPasswordBodySchema = z.object({
  email: z.string().trim().email('Enter a valid email'),
});

/**
 * Requests a password-reset email. Always returns the same generic success response
 * regardless of whether the address matches an account — same anti-enumeration
 * convention as POST /api/auth/signup. No session required; this is how a locked-out
 * user gets back in.
 *
 * The same email can be a separate User row in more than one organisation (see User's
 * @@unique([organizationId, email])) — e.g. someone who's a genuine member of several
 * orgs, or who was invited into a second org under the same address they already use
 * elsewhere. This used to look up a single arbitrary row via findFirst() and only ever
 * reset *that* account, silently ignoring any others — so a person with two accounts
 * under one email had no reliable way to reset the account they actually meant, and
 * whichever one WAS reset was effectively down to query order, not their choice. Issuing
 * a reset for every matching row instead means every one of a person's accounts gets its
 * own token and its own clearly-labelled email (see passwordResetEmail's organizationName
 * param), and clicking any link only ever resets that specific account's password.
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const { email } = forgotPasswordBodySchema.parse(await request.json());
    const normalizedEmail = email.toLowerCase();

    const users = await prisma.user.findMany({
      where: { email: normalizedEmail },
      select: {
        id: true,
        email: true,
        name: true,
        organizationId: true,
        organization: { select: { name: true } },
      },
    });

    if (users.length === 0) {
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    // Only worth naming the org in the email once there's more than one account to tell
    // apart — a lone match keeps the original, simpler copy.
    const disambiguate = users.length > 1;
    const resetUrls = await Promise.all(
      users.map((user) =>
        issuePasswordReset({
          ...user,
          organizationName: disambiguate ? (user.organization?.name ?? null) : null,
        }),
      ),
    );

    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json({ ok: true, devResetUrls: resetUrls }, { status: 200 });
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
