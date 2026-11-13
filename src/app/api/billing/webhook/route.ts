import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { getStripe, getWebhookSecret } from '@/lib/billing/stripe';
import { syncSubscriptionById } from '@/lib/billing/sync';
import { prisma } from '@/lib/db';
import { log } from '@/lib/log';

// Stripe needs the raw request body to verify the signature, and this route must never be
// cached or statically optimised.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** The subscription id an event refers to, or null when it isn't about a subscription. */
function subscriptionIdFor(event: Stripe.Event): string | null {
  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
      return event.data.object.id;
    case 'checkout.session.completed': {
      const session = event.data.object;
      if (session.mode !== 'subscription' || !session.subscription) return null;
      return typeof session.subscription === 'string'
        ? session.subscription
        : session.subscription.id;
    }
    case 'invoice.paid':
    case 'invoice.payment_failed': {
      const reference = event.data.object.parent?.subscription_details?.subscription;
      if (!reference) return null;
      return typeof reference === 'string' ? reference : reference.id;
    }
    default:
      return null;
  }
}

/**
 * Stripe webhook. Stripe is the source of truth: each relevant event just triggers a re-sync
 * of the subscription it refers to (src/lib/billing/sync.ts), so duplicate, delayed or
 * out-of-order deliveries all converge on the same state. `billing_events` makes redelivery
 * a no-op once an event has been processed.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const signature = request.headers.get('stripe-signature');
  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  const payload = await request.text();
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(payload, signature, getWebhookSecret());
  } catch (error) {
    log.warn('billing.webhook_signature_invalid', { error });
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  const subscriptionId = subscriptionIdFor(event);
  if (!subscriptionId) {
    // Not an event we act on. Acknowledge so Stripe stops retrying it.
    return NextResponse.json({ received: true, ignored: true });
  }

  // Claim the event. A unique violation means we've seen it before.
  const existing = await prisma.billingEvent.findUnique({ where: { stripeEventId: event.id } });
  if (existing?.processedAt) {
    return NextResponse.json({ received: true, duplicate: true });
  }
  if (!existing) {
    try {
      await prisma.billingEvent.create({ data: { stripeEventId: event.id, type: event.type } });
    } catch {
      // Lost a race with a concurrent delivery of the same event; that one will process it.
      return NextResponse.json({ received: true, duplicate: true });
    }
  }

  try {
    await syncSubscriptionById(subscriptionId);
    await prisma.billingEvent.update({
      where: { stripeEventId: event.id },
      data: { processedAt: new Date(), error: null },
    });
    return NextResponse.json({ received: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.error('billing.webhook_processing_failed', {
      stripeEventType: event.type,
      stripeEventId: event.id,
      error,
    });
    await prisma.billingEvent
      .update({ where: { stripeEventId: event.id }, data: { error: message.slice(0, 500) } })
      .catch(() => undefined);
    // 500 makes Stripe retry with backoff.
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 });
  }
}
