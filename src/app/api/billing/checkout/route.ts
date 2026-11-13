import { NextResponse } from 'next/server';
import { z } from 'zod';
import { InvalidRequestError, toErrorResponse } from '@/lib/api-errors';
import { findPendingCheckoutGrant } from '@/lib/billing/admin';
import { PAID_PLANS, type PaidPlan, priceLookupKey } from '@/lib/billing/config';
import { ensureStripeCustomer } from '@/lib/billing/customer';
import { accessForStripeStatus } from '@/lib/billing/status';
import { BillingNotConfiguredError, getStripe, getTaxConfig } from '@/lib/billing/stripe';
import { withOrgContext } from '@/lib/db';
import { log } from '@/lib/log';
import { ForbiddenError, requireOrganizationId, requireRole, requireSession } from '@/lib/session';
import { resolveReturnOrigin } from '@/lib/tenant';

const bodySchema = z.object({
  plan: z.enum(PAID_PLANS as readonly [PaidPlan, ...PaidPlan[]]),
  interval: z.enum(['month', 'year']),
});

/**
 * Starts a Stripe Checkout Session for the signed-in organisation's admin and returns its
 * URL. Deliberately does NOT call assertOrgActionsAllowed: an organisation whose trial has
 * ended must still be able to subscribe. Subscription state is written by the webhook
 * (src/app/api/billing/webhook), never here.
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const session = await requireSession();
    requireRole(session, ['admin']);
    const body = bodySchema.parse(await request.json());
    const organizationId = requireOrganizationId(session);

    const organization = await withOrgContext(organizationId, (tx) =>
      tx.organization.findUniqueOrThrow({
        where: { id: organizationId },
        select: {
          id: true,
          name: true,
          subdomain: true,
          contactEmail: true,
          stripeCustomerId: true,
          status: true,
          subscription: { select: { stripeStatus: true } },
        },
      }),
    );

    if (organization.status === 'suspended') {
      throw new ForbiddenError('This organisation is suspended. Please contact support.');
    }
    if (
      organization.subscription &&
      accessForStripeStatus(organization.subscription.stripeStatus) !== 'read_only'
    ) {
      throw new InvalidRequestError(
        'This organisation already has a subscription. Use "Manage billing" to change it.',
      );
    }

    const stripe = getStripe();

    const prices = await stripe.prices.list({
      lookup_keys: [priceLookupKey(body.plan, body.interval)],
      active: true,
      limit: 1,
    });
    const price = prices.data[0];
    if (!price) {
      log.error('billing.price_not_found', {
        lookupKey: priceLookupKey(body.plan, body.interval),
      });
      throw new InvalidRequestError('This plan is not available for purchase yet.');
    }

    const customerId =
      organization.stripeCustomerId ??
      (await ensureStripeCustomer(organizationId, session.user.email));

    // An admin-granted discount waiting for this organisation to subscribe. Checkout accepts
    // a single discount and cannot combine it with customer-entered codes, so when a grant
    // exists it replaces the promotion-code box for this session.
    const pendingGrant = await findPendingCheckoutGrant(organizationId);

    const tax = getTaxConfig();
    const origin = resolveReturnOrigin(request, organization.subdomain);
    const checkout = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      client_reference_id: organizationId,
      line_items: [
        {
          price: price.id,
          quantity: 1,
          ...(!tax.automaticTax && tax.gstTaxRateId ? { tax_rates: [tax.gstTaxRateId] } : {}),
        },
      ],
      ...(tax.automaticTax ? { automatic_tax: { enabled: true } } : {}),
      // Business customers: ABN is collected as a tax id and printed on the tax invoice.
      billing_address_collection: 'required',
      tax_id_collection: { enabled: true },
      customer_update: { name: 'auto', address: 'auto' },
      // Customers can enter a promotion code unless an admin-granted discount is applied.
      ...(pendingGrant
        ? { discounts: [{ promotion_code: pendingGrant.stripePromotionCodeId }] }
        : { allow_promotion_codes: true }),
      subscription_data: {
        // Flexible billing mode: accurate prorations and discount handling.
        billing_mode: { type: 'flexible' },
        metadata: { organizationId, plan: body.plan, interval: body.interval },
      },
      metadata: { organizationId, plan: body.plan, interval: body.interval },
      success_url: `${origin}/forms/organisation?tab=billing&billing=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/forms/organisation?tab=billing`,
    });

    if (!checkout.url) {
      throw new Error('Stripe returned a Checkout Session without a URL');
    }
    return NextResponse.json({ url: checkout.url });
  } catch (error) {
    if (error instanceof BillingNotConfiguredError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    return toErrorResponse(error);
  }
}
