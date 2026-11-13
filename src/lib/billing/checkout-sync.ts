import 'server-only';

import { log } from '@/lib/log';
import { getStripe } from './stripe';
import { syncSubscriptionById } from './sync';

/** Safety net for the Checkout redirect: the webhook normally has already written the
 * subscription, but it can lag a few seconds behind the customer's browser. Re-sync it so the
 * page they land on shows their new plan. Only accepts a Checkout Session that belongs to this
 * organisation. */
export async function syncAfterCheckout(organizationId: string, sessionId: string): Promise<void> {
  try {
    const checkout = await getStripe().checkout.sessions.retrieve(sessionId);
    if (checkout.metadata?.organizationId !== organizationId || !checkout.subscription) return;
    await syncSubscriptionById(
      typeof checkout.subscription === 'string' ? checkout.subscription : checkout.subscription.id,
    );
  } catch (error) {
    // The webhook will still deliver the same state; this is best effort.
    log.warn('billing.checkout_sync_failed', { error });
  }
}
