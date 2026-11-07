import { NextResponse } from 'next/server';
import { toErrorResponse } from '@/lib/api-errors';
import { loadBillingDetails } from '@/lib/billing/details';
import { billingErrorResponse } from '@/lib/billing/route-helpers';
import { BillingNotConfiguredError } from '@/lib/billing/stripe';
import { requireOrganizationId, requireRole, requireSession } from '@/lib/session';

/** Card on file and recent invoices for the signed-in organisation's admin. */
export async function GET(): Promise<NextResponse> {
  try {
    const session = await requireSession();
    requireRole(session, ['admin']);
    const organizationId = requireOrganizationId(session);
    return NextResponse.json(await loadBillingDetails(organizationId));
  } catch (error) {
    if (error instanceof BillingNotConfiguredError) return billingErrorResponse(error);
    return toErrorResponse(error);
  }
}
