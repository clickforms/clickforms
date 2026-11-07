import 'server-only';

import Stripe from 'stripe';
import { withOrgContext } from '@/lib/db';
import { getStripe } from './stripe';
import type { BillingDetails, BillingPaymentMethod } from './types';

function toPaymentMethod(method: Stripe.PaymentMethod | null): BillingPaymentMethod | null {
  if (method?.type === 'link') return { type: 'link', email: method.link?.email ?? null };
  if (!method?.card) return null;
  return {
    type: 'card',
    brand: method.card.brand,
    last4: method.card.last4,
    expMonth: method.card.exp_month,
    expYear: method.card.exp_year,
  };
}

/** The organisation's card on file and recent invoices, read live from Stripe. Called from an
 * API route (not during page render) so a slow Stripe never delays the settings page. */
export async function loadBillingDetails(organizationId: string): Promise<BillingDetails> {
  const organization = await withOrgContext(organizationId, (tx) =>
    tx.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: { stripeCustomerId: true, subscription: { select: { stripeSubscriptionId: true } } },
    }),
  );
  const customerId = organization.stripeCustomerId;
  const subscriptionId = organization.subscription?.stripeSubscriptionId ?? null;
  if (!customerId) return { paymentMethod: null, invoices: [] };

  const stripe = getStripe();
  const [subscription, customer, invoices] = await Promise.all([
    subscriptionId
      ? stripe.subscriptions.retrieve(subscriptionId, { expand: ['default_payment_method'] })
      : Promise.resolve(null),
    stripe.customers.retrieve(customerId, { expand: ['invoice_settings.default_payment_method'] }),
    stripe.invoices.list({ customer: customerId, limit: 100 }),
  ]);

  // Where the card lives depends on how it was saved. Checkout (including cards saved through
  // Link) stores it on the subscription, not as the customer default, so look there first.
  const subscriptionMethod = subscription?.default_payment_method;
  let paymentMethod: BillingPaymentMethod | null =
    subscriptionMethod && typeof subscriptionMethod !== 'string'
      ? toPaymentMethod(subscriptionMethod)
      : null;

  if (!paymentMethod && !customer.deleted) {
    const defaultMethod = customer.invoice_settings.default_payment_method;
    if (defaultMethod && typeof defaultMethod !== 'string') {
      paymentMethod = toPaymentMethod(defaultMethod);
    }
  }
  if (!paymentMethod) {
    const methods = await stripe.paymentMethods.list({ customer: customerId, limit: 10 });
    for (const method of methods.data) {
      paymentMethod = toPaymentMethod(method);
      if (paymentMethod) break;
    }
  }

  return {
    paymentMethod,
    invoices: invoices.data
      .filter((invoice) => invoice.status && invoice.status !== 'draft')
      .map((invoice) => ({
        id: invoice.id ?? '',
        number: invoice.number,
        createdAt: new Date(invoice.created * 1000).toISOString(),
        amountCents: invoice.amount_due,
        currency: invoice.currency,
        status: invoice.status ?? 'open',
        hostedInvoiceUrl: invoice.hosted_invoice_url ?? null,
        pdfUrl: invoice.invoice_pdf ?? null,
      })),
  };
}

export function isStripeError(error: unknown): error is Stripe.errors.StripeError {
  return error instanceof Stripe.errors.StripeError;
}
