import { NextResponse } from 'next/server';
import { z } from 'zod';
import { runInvoiceAction } from '@/lib/billing/admin';
import { actorFrom, billingErrorResponse } from '@/lib/billing/route-helpers';
import { requirePlatformAdmin, requireSession } from '@/lib/session';

interface RouteContext {
  params: Promise<{ id: string; invoiceId: string }>;
}

const bodySchema = z.object({ action: z.enum(['retry', 'void', 'mark_paid']) });

/** Retry payment on a failed or open invoice, void it, or mark it paid out of band (bank
 * transfer). A declined card responds 200 with ok:false and the reason, since that is an
 * expected outcome the admin needs to read, not a server error. */
export async function POST(request: Request, { params }: RouteContext): Promise<NextResponse> {
  try {
    const session = await requireSession();
    requirePlatformAdmin(session);
    const { id, invoiceId } = await params;
    const body = bodySchema.parse(await request.json());
    const result = await runInvoiceAction(id, invoiceId, body.action, actorFrom(session));
    return NextResponse.json(result);
  } catch (error) {
    return billingErrorResponse(error);
  }
}
