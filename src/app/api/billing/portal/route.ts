import { NextResponse } from 'next/server';
import { InvalidRequestError, toErrorResponse } from '@/lib/api-errors';
import { BillingNotConfiguredError, getStripe } from '@/lib/billing/stripe';
import { withOrgContext } from '@/lib/db';
import { requireOrganizationId, requireRole, requireSession } from '@/lib/session';
import { resolveReturnOrigin } from '@/lib/tenant';

/** Opens the Stripe Customer Portal (payment method, invoices, cancellation) for the
 * signed-in organisation's admin. Plan changes are NOT done in the portal: they go through
 * our own flow so plan limits can be checked first. */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const session = await requireSession();
    requireRole(session, ['admin']);
    const organizationId = requireOrganizationId(session);

    const organization = await withOrgContext(organizationId, (tx) =>
      tx.organization.findUniqueOrThrow({
        where: { id: organizationId },
        select: { subdomain: true, stripeCustomerId: true },
      }),
    );
    if (!organization.stripeCustomerId) {
      throw new InvalidRequestError('This organisation has no billing account yet.');
    }

    const portal = await getStripe().billingPortal.sessions.create({
      customer: organization.stripeCustomerId,
      return_url: `${resolveReturnOrigin(request, organization.subdomain)}/forms/organisation?tab=billing`,
      ...(process.env.STRIPE_PORTAL_CONFIGURATION_ID
        ? { configuration: process.env.STRIPE_PORTAL_CONFIGURATION_ID }
        : {}),
    });
    return NextResponse.json({ url: portal.url });
  } catch (error) {
    if (error instanceof BillingNotConfiguredError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    return toErrorResponse(error);
  }
}
