import 'server-only';

import { withOrgContext } from '@/lib/db';
import { getStripe } from './stripe';

/** Returns the organisation's Stripe customer id, creating the customer on first use.
 * Used by Checkout and by platform-admin actions (credit, pre-subscription discounts). */
export async function ensureStripeCustomer(
  organizationId: string,
  fallbackEmail?: string | null,
): Promise<string> {
  const organization = await withOrgContext(organizationId, (tx) =>
    tx.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: { name: true, contactEmail: true, stripeCustomerId: true },
    }),
  );
  if (organization.stripeCustomerId) return organization.stripeCustomerId;

  // Idempotency key: two quick clicks (or a retry) can never create two customers.
  const customer = await getStripe().customers.create(
    {
      name: organization.name,
      email: organization.contactEmail ?? fallbackEmail ?? undefined,
      metadata: { organizationId },
    },
    { idempotencyKey: `clickforms-customer-${organizationId}` },
  );
  await withOrgContext(organizationId, (tx) =>
    tx.organization.update({
      where: { id: organizationId },
      data: { stripeCustomerId: customer.id },
    }),
  );
  return customer.id;
}
