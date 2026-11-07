import { NextResponse } from 'next/server';
import { getAdminBillingOverview } from '@/lib/billing/admin';
import { billingErrorResponse } from '@/lib/billing/route-helpers';
import { requirePlatformAdmin, requireSession } from '@/lib/session';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/** Subscription, invoices (live from Stripe), balance and discount history for one
 * organisation. Platform admin only. */
export async function GET(_request: Request, { params }: RouteContext): Promise<NextResponse> {
  try {
    const session = await requireSession();
    requirePlatformAdmin(session);
    const { id } = await params;
    return NextResponse.json(await getAdminBillingOverview(id));
  } catch (error) {
    return billingErrorResponse(error);
  }
}
