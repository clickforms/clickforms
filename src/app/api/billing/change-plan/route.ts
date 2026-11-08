import { NextResponse } from 'next/server';
import { z } from 'zod';
import { computeOverLimitLabels, PLAN_LABELS } from '@/lib/admin/plan-limits';
import { InvalidRequestError, toErrorResponse } from '@/lib/api-errors';
import { logAudit } from '@/lib/audit';
import { PAID_PLANS, type PaidPlan, priceLookupKey } from '@/lib/billing/config';
import { accessForStripeStatus } from '@/lib/billing/status';
import { BillingNotConfiguredError, getStripe } from '@/lib/billing/stripe';
import { syncSubscriptionById } from '@/lib/billing/sync';
import { getOrgPlanUsage } from '@/lib/billing/usage';
import { withOrgContext } from '@/lib/db';
import { requireOrganizationId, requireRole, requireSession } from '@/lib/session';

const bodySchema = z.object({
  plan: z.enum(['free', ...(PAID_PLANS as readonly [PaidPlan, ...PaidPlan[]])]),
  interval: z.enum(['month', 'year']).default('month'),
});

/**
 * Changes the plan or billing interval of an organisation that already has a live Stripe
 * subscription. The change takes effect immediately and Stripe prorates it: an upgrade is
 * charged for the rest of the period straight away, a downgrade is credited against the next
 * invoice. A downgrade is refused while current usage is over the lower plan's limits.
 * Organisations without a subscription go through /api/billing/checkout instead.
 *
 * `plan: 'free'` leaves the paid plans: a live subscription is set to cancel at the end of the
 * period already paid for (the sync drops the organisation to Free when it ends); an
 * organisation with no live subscription moves to Free straight away. Usage above the Free
 * limits is allowed, as with any downgrade: nothing is deleted, only adding more is blocked.
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const session = await requireSession();
    requireRole(session, ['admin']);
    const body = bodySchema.parse(await request.json());
    const organizationId = requireOrganizationId(session);

    const { subscription, usage, currentPlan, orgStatus } = await withOrgContext(
      organizationId,
      async (tx) => {
        const org = await tx.organization.findUniqueOrThrow({
          where: { id: organizationId },
          select: { plan: true, status: true, subscription: true },
        });
        return {
          subscription: org.subscription,
          currentPlan: org.plan,
          orgStatus: org.status,
          usage: await getOrgPlanUsage(tx, organizationId),
        };
      },
    );

    if (body.plan === 'free') {
      if (currentPlan === 'free') {
        throw new InvalidRequestError('This organisation is already on the Free plan.');
      }
      const live = subscription && accessForStripeStatus(subscription.stripeStatus) !== 'read_only';
      if (live && subscription) {
        const stripe = getStripe();
        await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
          cancel_at_period_end: true,
        });
        await syncSubscriptionById(subscription.stripeSubscriptionId);
      } else {
        await withOrgContext(organizationId, (tx) =>
          tx.organization.update({
            where: { id: organizationId },
            data: {
              plan: 'free',
              ...(orgStatus === 'trial' ? { status: 'active' as const, trialEndsAt: null } : {}),
            },
          }),
        );
      }
      await withOrgContext(organizationId, (tx) =>
        logAudit(
          {
            organizationId,
            actorUserId: session.user.id,
            action: 'organization.plan_change',
            entityType: 'organization',
            entityId: organizationId,
            metadata: {
              fromPlan: currentPlan,
              toPlan: 'free',
              scheduled: Boolean(live),
              via: 'stripe',
            },
          },
          tx,
        ),
      );
      return NextResponse.json({
        ok: true,
        scheduled: Boolean(live),
        endsAt: live ? (subscription?.currentPeriodEnd?.toISOString() ?? null) : null,
      });
    }

    if (!subscription || accessForStripeStatus(subscription.stripeStatus) === 'read_only') {
      throw new InvalidRequestError('This organisation has no active subscription to change.');
    }
    if (body.plan === subscription.plan && body.interval === subscription.interval) {
      throw new InvalidRequestError('This organisation is already on that plan.');
    }

    const overLimit = computeOverLimitLabels(body.plan, usage);
    if (overLimit.length > 0) {
      throw new InvalidRequestError(
        `You are over the ${PLAN_LABELS[body.plan]} plan's limit on ${overLimit.join(', ')}. Reduce usage first, or choose a higher plan.`,
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
      throw new InvalidRequestError('This plan is not available for purchase yet.');
    }

    const live = await stripe.subscriptions.retrieve(subscription.stripeSubscriptionId);
    const item = live.items.data[0];
    if (!item) {
      throw new Error(`Subscription ${live.id} has no items`);
    }

    await stripe.subscriptions.update(
      live.id,
      {
        items: [{ id: item.id, price: price.id }],
        // Charge an upgrade now; a downgrade becomes credit on the next invoice.
        proration_behavior: 'always_invoice',
        metadata: { ...live.metadata, plan: body.plan, interval: body.interval },
      },
      // Same request twice (double click, retry) is one change.
      {
        idempotencyKey: `change-plan-${live.id}-${body.plan}-${body.interval}-${item.id}-${item.price.id}`,
      },
    );

    // Don't wait for the webhook: the page the admin lands on next must show the new plan.
    await syncSubscriptionById(live.id);

    await withOrgContext(organizationId, (tx) =>
      logAudit(
        {
          organizationId,
          actorUserId: session.user.id,
          action: 'organization.plan_change',
          entityType: 'organization',
          entityId: organizationId,
          metadata: {
            fromPlan: currentPlan,
            toPlan: body.plan,
            fromInterval: subscription.interval,
            toInterval: body.interval,
            via: 'stripe',
          },
        },
        tx,
      ),
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof BillingNotConfiguredError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    return toErrorResponse(error);
  }
}
