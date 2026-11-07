import { NextResponse } from 'next/server';
import { z } from 'zod';
import { setPromotionCodeActive } from '@/lib/billing/admin';
import { actorFrom, billingErrorResponse } from '@/lib/billing/route-helpers';
import { requirePlatformAdmin, requireSession } from '@/lib/session';

interface RouteContext {
  params: Promise<{ id: string }>;
}

const bodySchema = z.object({ active: z.boolean() });

/** Activate or deactivate a promotion code. Codes are never deleted: Stripe keeps the
 * redemption history, and a deactivated code simply stops working. */
export async function PATCH(request: Request, { params }: RouteContext): Promise<NextResponse> {
  try {
    const session = await requireSession();
    requirePlatformAdmin(session);
    const { id } = await params;
    const body = bodySchema.parse(await request.json());
    await setPromotionCodeActive(id, body.active, actorFrom(session));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return billingErrorResponse(error);
  }
}
