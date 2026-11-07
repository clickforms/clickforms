import { NextResponse } from 'next/server';
import { z } from 'zod';
import { runSubscriptionAction } from '@/lib/billing/admin';
import { actorFrom, billingErrorResponse } from '@/lib/billing/route-helpers';
import { requirePlatformAdmin, requireSession } from '@/lib/session';

interface RouteContext {
  params: Promise<{ id: string }>;
}

const bodySchema = z.object({
  action: z.enum(['cancel_at_period_end', 'resume', 'cancel_now']),
});

/** Cancel at period end, undo a scheduled cancellation, or cancel immediately. */
export async function POST(request: Request, { params }: RouteContext): Promise<NextResponse> {
  try {
    const session = await requireSession();
    requirePlatformAdmin(session);
    const { id } = await params;
    const body = bodySchema.parse(await request.json());
    await runSubscriptionAction(id, body.action, actorFrom(session));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return billingErrorResponse(error);
  }
}
