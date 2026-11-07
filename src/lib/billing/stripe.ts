import 'server-only';

import Stripe from 'stripe';

// Single Stripe client for the whole app. Keys come from Infisical (test keys in dev and
// staging, live keys in prod only) and are never logged.

let client: Stripe | null = null;

export class BillingNotConfiguredError extends Error {
  constructor() {
    super('Billing is not configured on this environment.');
    this.name = 'BillingNotConfiguredError';
  }
}

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new BillingNotConfiguredError();
  }
  client ??= new Stripe(key, {
    maxNetworkRetries: 2,
    appInfo: { name: 'Clickforms', url: 'https://clickforms.com.au' },
  });
  return client;
}

export function getWebhookSecret(): string {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    throw new BillingNotConfiguredError();
  }
  return secret;
}

/** Stripe Tax computes GST at Checkout once the business's GST registration is added in the
 * Stripe dashboard. Until then, set STRIPE_GST_TAX_RATE_ID to an inclusive 10% GST tax rate so
 * invoices still itemise GST. Prices are always GST-inclusive. */
export function getTaxConfig(): { automaticTax: boolean; gstTaxRateId: string | null } {
  return {
    automaticTax: process.env.STRIPE_AUTOMATIC_TAX === 'true',
    gstTaxRateId: process.env.STRIPE_GST_TAX_RATE_ID || null,
  };
}
