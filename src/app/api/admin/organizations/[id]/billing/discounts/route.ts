import { NextResponse } from 'next/server';
import { grantDiscount } from '@/lib/billing/admin';
import { grantInputSchema } from '@/lib/billing/grants';
import { actorFrom, billingErrorResponse } from '@/lib/billing/route-helpers';
import { requirePlatformAdmin, requireSession } from '@/lib/session';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/** Grants an organisation a discount, free months or account credit. Applied to the live
 * subscription immediately, or held for Checkout when the organisation hasn't subscribed. */
export async function POST(request: Request, { params }: RouteContext): Promise<NextResponse> {
  try {
    const session = await requireSession();
    requirePlatformAdmin(session);
    const { id } = await params;
    const input = grantInputSchema.parse(await request.json());
    const grant = await grantDiscount(id, input, actorFrom(session));
    return NextResponse.json({ grant }, { status: 201 });
  } catch (error) {
    return billingErrorResponse(error);
  }
}
