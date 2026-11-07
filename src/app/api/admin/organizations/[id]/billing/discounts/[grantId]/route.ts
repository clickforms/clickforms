import { NextResponse } from 'next/server';
import { revokeGrant } from '@/lib/billing/admin';
import { actorFrom, billingErrorResponse } from '@/lib/billing/route-helpers';
import { requirePlatformAdmin, requireSession } from '@/lib/session';

interface RouteContext {
  params: Promise<{ id: string; grantId: string }>;
}

/** Removes a discount from future invoices (or cancels one that hasn't been used yet). */
export async function DELETE(_request: Request, { params }: RouteContext): Promise<NextResponse> {
  try {
    const session = await requireSession();
    requirePlatformAdmin(session);
    const { id, grantId } = await params;
    await revokeGrant(id, grantId, actorFrom(session));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return billingErrorResponse(error);
  }
}
