import { config as loadEnv } from 'dotenv';
import Stripe from 'stripe';
import { PLAN_LABELS, PLAN_PRICING } from '../src/lib/admin/plan-limits';
import {
  annualTotalCents,
  monthlyCents,
  PAID_PLANS,
  priceLookupKey,
} from '../src/lib/billing/config';

// One-off, idempotent setup of the Stripe catalogue and Customer Portal for an account
// (sandbox first, then live):
//
//   STRIPE_SECRET_KEY=sk_test_... yarn billing:setup-prices
//
// Creates a product per paid plan and a GST-inclusive AUD monthly and annual price per product,
// keyed by lookup key (e.g. standard_monthly), and skips anything that already exists, so it is
// safe to re-run. Prices are immutable in Stripe: if a price ever changes, create a new price
// with `transfer_lookup_key: true` in the dashboard instead of editing it here.
// It also creates a Customer Portal configuration (payment method, invoices, cancellation;
// plan switching is off because plan changes go through the app's own limit checks) and prints
// the id to set as STRIPE_PORTAL_CONFIGURATION_ID.
loadEnv({ path: '.env.local', quiet: true });

const SAAS_BUSINESS_TAX_CODE = 'txcd_10103001';

async function main(): Promise<void> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error('Set STRIPE_SECRET_KEY (use a test key first).');
  }
  const stripe = new Stripe(key);
  console.log(
    `Account mode: ${key.startsWith('sk_live') || key.startsWith('rk_live') ? 'LIVE' : 'test'}`,
  );

  for (const plan of PAID_PLANS) {
    const productId = `clickforms_${plan}`;
    const monthly = PLAN_PRICING[plan].monthly;
    if (monthly === null) continue;

    const existingProduct = await stripe.products.retrieve(productId).catch(() => null);
    if (!existingProduct) {
      await stripe.products.create({
        id: productId,
        name: `Clickforms ${PLAN_LABELS[plan]}`,
        tax_code: SAAS_BUSINESS_TAX_CODE,
        metadata: { plan },
      });
      console.log(`created product ${productId}`);
    }

    for (const interval of ['month', 'year'] as const) {
      const lookupKey = priceLookupKey(plan, interval);
      const found = await stripe.prices.list({ lookup_keys: [lookupKey], limit: 1 });
      if (found.data.length > 0) {
        console.log(`exists  ${lookupKey}`);
        continue;
      }
      const unitAmount = interval === 'year' ? annualTotalCents(monthly) : monthlyCents(monthly);
      await stripe.prices.create({
        product: productId,
        currency: 'aud',
        unit_amount: unitAmount,
        tax_behavior: 'inclusive',
        lookup_key: lookupKey,
        recurring: { interval },
        metadata: { plan, interval },
      });
      console.log(`created ${lookupKey}: ${(unitAmount / 100).toFixed(2)} AUD, GST inclusive`);
    }
  }

  const portal = await stripe.billingPortal.configurations.create({
    business_profile: { headline: 'Manage your Clickforms billing' },
    features: {
      customer_update: { enabled: true, allowed_updates: ['name', 'address', 'tax_id'] },
      invoice_history: { enabled: true },
      payment_method_update: { enabled: true },
      subscription_cancel: { enabled: true, mode: 'at_period_end' },
      subscription_update: { enabled: false },
    },
  });
  console.log(`\nPortal configuration: ${portal.id}  (set STRIPE_PORTAL_CONFIGURATION_ID to this)`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
