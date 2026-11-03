import { NextResponse } from 'next/server';
import { InvalidRequestError, toErrorResponse } from '@/lib/api-errors';
import { issueTwoFactorCode } from '@/lib/auth/two-factor';
import { withUserScope } from '@/lib/auth/user-scope';
import { requireSession } from '@/lib/session';

/** Emails the signed-in user a code to confirm they can receive it before two-step is enabled. */
export async function POST(): Promise<NextResponse> {
  try {
    const session = await requireSession();
    const user = await withUserScope(session.user.organizationId, (tx) =>
      tx.user.findUnique({ where: { id: session.user.id } }),
    );
    if (!user) throw new InvalidRequestError('Account not found.');
    if (user.twoFactorEnabled) {
      throw new InvalidRequestError('Two-step verification is already on.');
    }
    await issueTwoFactorCode(user, 'enable');
    return NextResponse.json({ ok: true });
  } catch (error) {
    return toErrorResponse(error);
  }
}
