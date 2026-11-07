import { NextResponse } from 'next/server';
import { createPromotionCode, listPromotionCodes } from '@/lib/billing/admin';
import { promotionCodeInputSchema } from '@/lib/billing/grants';
import { actorFrom, billingErrorResponse } from '@/lib/billing/route-helpers';
import { requirePlatformAdmin, requireSession } from '@/lib/session';

/** Campaign promotion codes customers can enter at Checkout. Platform admin only. */
export async function GET(): Promise<NextResponse> {
  try {
    const session = await requireSession();
    requirePlatformAdmin(session);
    return NextResponse.json({ codes: await listPromotionCodes() });
  } catch (error) {
    return billingErrorResponse(error);
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const session = await requireSession();
    requirePlatformAdmin(session);
    const input = promotionCodeInputSchema.parse(await request.json());
    const code = await createPromotionCode(input, actorFrom(session));
    return NextResponse.json({ code }, { status: 201 });
  } catch (error) {
    return billingErrorResponse(error);
  }
}
