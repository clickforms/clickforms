import 'server-only';

import { randomUUID } from 'node:crypto';
import type { BillingDiscountGrant, Prisma } from '@prisma/client';
import Stripe from 'stripe';
import { InvalidRequestError, NotFoundError } from '@/lib/api-errors';
import { logAudit } from '@/lib/audit';
import { prisma, withOrgContext } from '@/lib/db';
import { log } from '@/lib/log';
import { ensureStripeCustomer } from './customer';
import {
  couponParams,
  describeGrant,
  endOfDayUnix,
  type GrantInput,
  type GrantShape,
  grantShape,
  type PromotionCodeInput,
} from './grants';
import { accessForStripeStatus } from './status';
import { getStripe } from './stripe';
import { syncSubscriptionById } from './sync';

// Platform-admin billing operations (specs/08-billing.md, Phase 2). Every function here is
// called only from routes guarded by requirePlatformAdmin, and every mutation is audit-logged.

export interface AdminActor {
  id: string;
  email: string;
}

// --- Helpers ---------------------------------------------------------------------------

function isTestMode(): boolean {
  return /^(sk|rk)_test_/.test(process.env.STRIPE_SECRET_KEY ?? '');
}

/** Link to an object in the Stripe dashboard, matching the mode of the configured key. */
export function stripeDashboardUrl(path: string): string {
  return `https://dashboard.stripe.com${isTestMode() ? '/test' : ''}/${path}`;
}

async function audit(
  organizationId: string,
  actor: AdminActor,
  action: string,
  entityId: string,
  metadata: Record<string, unknown>,
): Promise<void> {
  await withOrgContext(organizationId, (tx) =>
    logAudit(
      {
        organizationId,
        actorUserId: actor.id,
        action,
        entityType: 'billing',
        entityId,
        metadata,
      },
      tx,
    ),
  );
}

/** Turns a Stripe API error into a message an admin can act on. */
function stripeMessage(error: unknown): string {
  if (error instanceof Stripe.errors.StripeError) return error.message;
  return error instanceof Error ? error.message : 'Stripe request failed.';
}

async function loadOrg(organizationId: string) {
  const organization = await withOrgContext(organizationId, (tx) =>
    tx.organization.findUnique({
      where: { id: organizationId },
      select: {
        id: true,
        name: true,
        status: true,
        plan: true,
        billingMode: true,
        stripeCustomerId: true,
        subscription: true,
      },
    }),
  );
  if (!organization) throw new NotFoundError('Organization');
  return organization;
}

function hasLiveSubscription(
  subscription: { stripeStatus: string } | null | undefined,
): subscription is { stripeStatus: string } {
  return !!subscription && accessForStripeStatus(subscription.stripeStatus) !== 'read_only';
}

function shapeOf(grant: BillingDiscountGrant): GrantShape {
  return {
    kind: grant.kind,
    value: grant.value,
    duration: grant.duration,
    durationMonths: grant.durationMonths,
  };
}

// --- Overview --------------------------------------------------------------------------

export interface AdminInvoice {
  id: string;
  number: string | null;
  status: string;
  amountDueCents: number;
  amountPaidCents: number;
  amountRemainingCents: number;
  currency: string;
  createdAt: string;
  dueDate: string | null;
  attemptCount: number;
  nextPaymentAttemptAt: string | null;
  collectionMethod: string;
  hostedInvoiceUrl: string | null;
  stripeUrl: string;
  /** True when "Retry payment" makes sense: an open invoice we can attempt to charge. */
  canRetry: boolean;
}

export interface AdminGrant {
  id: string;
  kind: GrantShape['kind'];
  label: string;
  reason: string;
  grantedByEmail: string;
  createdAt: string;
  appliedAt: string | null;
  revokedAt: string | null;
  status: 'pending' | 'applied' | 'revoked';
  revocable: boolean;
}

export interface AdminBillingOverview {
  stripeConfigured: boolean;
  billingMode: 'manual' | 'stripe';
  customerId: string | null;
  customerUrl: string | null;
  subscription: {
    id: string;
    status: string;
    plan: string;
    interval: 'month' | 'year';
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
    pastDueSince: string | null;
    discountLabel: string | null;
    live: boolean;
    stripeUrl: string;
  } | null;
  /** Stripe customer balance in cents; negative means the customer has credit. */
  balanceCents: number | null;
  invoices: AdminInvoice[];
  grants: AdminGrant[];
  /** Set when the Stripe calls failed; the DB-backed parts above are still returned. */
  stripeError: string | null;
}

function toAdminGrant(grant: BillingDiscountGrant): AdminGrant {
  const status = grant.revokedAt ? 'revoked' : grant.appliedAt ? 'applied' : 'pending';
  return {
    id: grant.id,
    kind: grant.kind,
    label: describeGrant(shapeOf(grant)),
    reason: grant.reason,
    grantedByEmail: grant.grantedByEmail,
    createdAt: grant.createdAt.toISOString(),
    appliedAt: grant.appliedAt?.toISOString() ?? null,
    revokedAt: grant.revokedAt?.toISOString() ?? null,
    status,
    // Credit is already on the customer balance and may be partly spent; adjust it in Stripe.
    revocable: status !== 'revoked' && grant.kind !== 'credit',
  };
}

function toAdminInvoice(invoice: Stripe.Invoice): AdminInvoice {
  return {
    id: invoice.id ?? '',
    number: invoice.number,
    status: invoice.status ?? 'draft',
    amountDueCents: invoice.amount_due,
    amountPaidCents: invoice.amount_paid,
    amountRemainingCents: invoice.amount_remaining,
    currency: invoice.currency,
    createdAt: new Date(invoice.created * 1000).toISOString(),
    dueDate: invoice.due_date ? new Date(invoice.due_date * 1000).toISOString() : null,
    attemptCount: invoice.attempt_count,
    nextPaymentAttemptAt: invoice.next_payment_attempt
      ? new Date(invoice.next_payment_attempt * 1000).toISOString()
      : null,
    collectionMethod: invoice.collection_method,
    hostedInvoiceUrl: invoice.hosted_invoice_url ?? null,
    stripeUrl: stripeDashboardUrl(`invoices/${invoice.id}`),
    canRetry: invoice.status === 'open' && invoice.amount_remaining > 0,
  };
}

/** Everything the platform-admin billing panel needs. DB state always loads; Stripe state
 * (invoices, balance) is best effort so a Stripe outage can't blank the whole page. */
export async function getAdminBillingOverview(
  organizationId: string,
): Promise<AdminBillingOverview> {
  const organization = await loadOrg(organizationId);
  const grants = await prisma.billingDiscountGrant.findMany({
    where: { organizationId },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  const subscription = organization.subscription;
  const overview: AdminBillingOverview = {
    stripeConfigured: !!process.env.STRIPE_SECRET_KEY,
    billingMode: organization.billingMode,
    customerId: organization.stripeCustomerId,
    customerUrl: organization.stripeCustomerId
      ? stripeDashboardUrl(`customers/${organization.stripeCustomerId}`)
      : null,
    subscription: subscription
      ? {
          id: subscription.stripeSubscriptionId,
          status: subscription.stripeStatus,
          plan: subscription.plan,
          interval: subscription.interval,
          currentPeriodEnd: subscription.currentPeriodEnd?.toISOString() ?? null,
          cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
          pastDueSince: subscription.pastDueSince?.toISOString() ?? null,
          discountLabel: discountLabelFrom(subscription.discountSummary),
          live: hasLiveSubscription(subscription),
          stripeUrl: stripeDashboardUrl(`subscriptions/${subscription.stripeSubscriptionId}`),
        }
      : null,
    balanceCents: null,
    invoices: [],
    grants: grants.map(toAdminGrant),
    stripeError: null,
  };

  if (!organization.stripeCustomerId || !overview.stripeConfigured) return overview;

  try {
    const stripe = getStripe();
    const [invoices, customer] = await Promise.all([
      stripe.invoices.list({ customer: organization.stripeCustomerId, limit: 12 }),
      stripe.customers.retrieve(organization.stripeCustomerId),
    ]);
    overview.invoices = invoices.data.map(toAdminInvoice);
    overview.balanceCents = customer.deleted ? null : customer.balance;
  } catch (error) {
    log.error('billing.admin_overview_failed', { error: stripeMessage(error) });
    overview.stripeError = stripeMessage(error);
  }
  return overview;
}

function discountLabelFrom(summary: Prisma.JsonValue | null): string | null {
  if (!summary || typeof summary !== 'object' || Array.isArray(summary)) return null;
  const { percentOff, amountOff } = summary as {
    percentOff?: number | null;
    amountOff?: number | null;
  };
  if (percentOff) return `${percentOff}% off`;
  if (amountOff) return `$${(amountOff / 100).toFixed(2)} off`;
  return null;
}

// --- Failed payments -------------------------------------------------------------------

export type InvoiceAction = 'retry' | 'void' | 'mark_paid';

export interface InvoiceActionResult {
  ok: boolean;
  /** Present when ok is false: why Stripe could not take the payment. */
  message?: string;
  invoice: AdminInvoice;
}

/** Retry payment / void / mark paid out of band for one of the organisation's invoices. The
 * invoice must belong to the organisation's Stripe customer; a stray id can't be used to
 * touch another customer's invoice. */
export async function runInvoiceAction(
  organizationId: string,
  invoiceId: string,
  action: InvoiceAction,
  actor: AdminActor,
): Promise<InvoiceActionResult> {
  const organization = await loadOrg(organizationId);
  if (!organization.stripeCustomerId) {
    throw new InvalidRequestError('This organisation has no Stripe customer.');
  }
  const stripe = getStripe();

  const existing = await stripe.invoices.retrieve(invoiceId);
  const customerId =
    typeof existing.customer === 'string' ? existing.customer : existing.customer?.id;
  if (customerId !== organization.stripeCustomerId) {
    throw new NotFoundError('Invoice');
  }
  if (existing.status !== 'open') {
    throw new InvalidRequestError(
      `Only open invoices can be changed (this one is ${existing.status}).`,
    );
  }

  let result: InvoiceActionResult;
  try {
    switch (action) {
      case 'retry': {
        const paid = await stripe.invoices.pay(invoiceId);
        result = { ok: paid.status === 'paid', invoice: toAdminInvoice(paid) };
        if (!result.ok) result.message = 'Payment did not complete. Check the invoice in Stripe.';
        break;
      }
      case 'void': {
        result = {
          ok: true,
          invoice: toAdminInvoice(await stripe.invoices.voidInvoice(invoiceId)),
        };
        break;
      }
      case 'mark_paid': {
        const paid = await stripe.invoices.pay(invoiceId, { paid_out_of_band: true });
        result = { ok: true, invoice: toAdminInvoice(paid) };
        break;
      }
    }
  } catch (error) {
    // A declined card is an expected outcome, not a server fault: report it to the admin.
    if (error instanceof Stripe.errors.StripeCardError) {
      await audit(organizationId, actor, 'admin.billing.invoice_retry_failed', invoiceId, {
        action,
        message: error.message,
        code: error.code,
      });
      const failed = await stripe.invoices.retrieve(invoiceId);
      await syncFromInvoice(failed);
      return { ok: false, message: error.message, invoice: toAdminInvoice(failed) };
    }
    if (error instanceof Stripe.errors.StripeError) {
      throw new InvalidRequestError(error.message);
    }
    throw error;
  }

  await audit(organizationId, actor, `admin.billing.invoice_${action}`, invoiceId, {
    ok: result.ok,
    amountRemainingCents: existing.amount_remaining,
  });
  await syncFromInvoice(await stripe.invoices.retrieve(invoiceId));
  return result;
}

/** Re-syncs the subscription an invoice belongs to, so past_due / active shows immediately
 * without waiting for the webhook. */
async function syncFromInvoice(invoice: Stripe.Invoice): Promise<void> {
  const reference = invoice.parent?.subscription_details?.subscription;
  const subscriptionId = typeof reference === 'string' ? reference : reference?.id;
  if (subscriptionId) await syncSubscriptionById(subscriptionId);
}

// --- Subscription actions --------------------------------------------------------------

export type SubscriptionAction = 'cancel_at_period_end' | 'resume' | 'cancel_now';

export async function runSubscriptionAction(
  organizationId: string,
  action: SubscriptionAction,
  actor: AdminActor,
): Promise<void> {
  const organization = await loadOrg(organizationId);
  const subscription = organization.subscription;
  if (!subscription) throw new InvalidRequestError('This organisation has no Stripe subscription.');
  const stripe = getStripe();

  try {
    switch (action) {
      case 'cancel_at_period_end':
        await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
          cancel_at_period_end: true,
        });
        break;
      case 'resume':
        if (!hasLiveSubscription(subscription)) {
          throw new InvalidRequestError(
            'This subscription has ended. Ask the customer to subscribe again.',
          );
        }
        await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
          cancel_at_period_end: false,
        });
        break;
      case 'cancel_now':
        await stripe.subscriptions.cancel(subscription.stripeSubscriptionId);
        break;
    }
  } catch (error) {
    if (error instanceof Stripe.errors.StripeError) throw new InvalidRequestError(error.message);
    throw error;
  }

  await audit(
    organizationId,
    actor,
    `admin.billing.subscription_${action}`,
    subscription.stripeSubscriptionId,
    {},
  );
  await syncSubscriptionById(subscription.stripeSubscriptionId);
}

// --- Discounts and credit --------------------------------------------------------------

/** The pending grant (if any) Checkout should apply for this organisation. */
export async function findPendingCheckoutGrant(
  organizationId: string,
): Promise<{ id: string; stripePromotionCodeId: string } | null> {
  const grant = await prisma.billingDiscountGrant.findFirst({
    where: {
      organizationId,
      appliedAt: null,
      revokedAt: null,
      stripePromotionCodeId: { not: null },
    },
    orderBy: { createdAt: 'desc' },
    select: { id: true, stripePromotionCodeId: true },
  });
  if (!grant?.stripePromotionCodeId) return null;
  return { id: grant.id, stripePromotionCodeId: grant.stripePromotionCodeId };
}

export async function grantDiscount(
  organizationId: string,
  input: GrantInput,
  actor: AdminActor,
): Promise<AdminGrant> {
  const organization = await loadOrg(organizationId);
  if (organization.status === 'suspended') {
    throw new InvalidRequestError('This organisation is suspended.');
  }
  const shape = grantShape(input);
  const stripe = getStripe();
  // Pre-generated so Stripe idempotency keys and the DB row share one identity: a retried
  // request can never create a second coupon or credit for the same grant.
  const grantId = randomUUID();
  const label = describeGrant(shape);

  let stripeCouponId: string | null = null;
  let stripePromotionCodeId: string | null = null;
  let stripeBalanceTxnId: string | null = null;
  let appliedAt: Date | null = null;

  try {
    if (shape.kind === 'credit') {
      const customerId = await ensureStripeCustomer(organizationId);
      const txn = await stripe.customers.createBalanceTransaction(
        customerId,
        {
          amount: -shape.value,
          currency: 'aud',
          description: `Account credit: ${input.reason}`,
          metadata: { organizationId, grantId },
        },
        { idempotencyKey: `clickforms-grant-${grantId}-credit` },
      );
      stripeBalanceTxnId = txn.id;
      appliedAt = new Date();
    } else {
      const params = couponParams(shape);
      if (!params) throw new InvalidRequestError('Unsupported discount.');
      const coupon = await stripe.coupons.create(
        {
          ...params,
          name: label.slice(0, 40),
          max_redemptions: 1,
          metadata: { organizationId, grantId, grantedBy: actor.email },
        },
        { idempotencyKey: `clickforms-grant-${grantId}-coupon` },
      );
      stripeCouponId = coupon.id;

      const subscription = organization.subscription;
      if (hasLiveSubscription(subscription) && organization.subscription) {
        // Attach straight to the live subscription, keeping any existing discounts.
        const current = await stripe.subscriptions.retrieve(
          organization.subscription.stripeSubscriptionId,
        );
        await stripe.subscriptions.update(
          organization.subscription.stripeSubscriptionId,
          {
            discounts: [
              ...current.discounts.map((entry) => ({
                discount: typeof entry === 'string' ? entry : entry.id,
              })),
              { coupon: coupon.id },
            ],
          },
          { idempotencyKey: `clickforms-grant-${grantId}-attach` },
        );
        appliedAt = new Date();
      } else {
        // Not subscribed yet (or the old subscription ended): hold the discount as a
        // promotion code only this customer can redeem; Checkout applies it automatically.
        const customerId = await ensureStripeCustomer(organizationId);
        const promotion = await stripe.promotionCodes.create(
          {
            promotion: { type: 'coupon', coupon: coupon.id },
            customer: customerId,
            max_redemptions: 1,
            metadata: { organizationId, grantId },
          },
          { idempotencyKey: `clickforms-grant-${grantId}-promo` },
        );
        stripePromotionCodeId = promotion.id;
      }
    }
  } catch (error) {
    if (error instanceof InvalidRequestError) throw error;
    if (error instanceof Stripe.errors.StripeError) throw new InvalidRequestError(error.message);
    throw error;
  }

  const grant = await prisma.billingDiscountGrant.create({
    data: {
      id: grantId,
      organizationId,
      kind: shape.kind,
      value: shape.value,
      duration: shape.duration,
      durationMonths: shape.durationMonths,
      stripeCouponId,
      stripePromotionCodeId,
      stripeBalanceTxnId,
      reason: input.reason,
      grantedBy: actor.id,
      grantedByEmail: actor.email,
      appliedAt,
    },
  });

  await audit(organizationId, actor, 'admin.billing.discount_grant', grantId, {
    label,
    reason: input.reason,
    applied: !!appliedAt,
  });
  if (appliedAt && organization.subscription) {
    await syncSubscriptionById(organization.subscription.stripeSubscriptionId);
  }
  return toAdminGrant(grant);
}

export async function revokeGrant(
  organizationId: string,
  grantId: string,
  actor: AdminActor,
): Promise<void> {
  const grant = await prisma.billingDiscountGrant.findFirst({
    where: { id: grantId, organizationId },
  });
  if (!grant) throw new NotFoundError('Discount');
  if (grant.revokedAt) throw new InvalidRequestError('This discount was already revoked.');
  if (grant.kind === 'credit') {
    throw new InvalidRequestError(
      'Account credit may already be partly used. Adjust the balance in Stripe instead.',
    );
  }

  const organization = await loadOrg(organizationId);
  const stripe = getStripe();
  try {
    if (grant.stripePromotionCodeId) {
      await stripe.promotionCodes.update(grant.stripePromotionCodeId, { active: false });
    }
    const subscription = organization.subscription;
    if (
      grant.appliedAt &&
      grant.stripeCouponId &&
      hasLiveSubscription(subscription) &&
      organization.subscription
    ) {
      const current = await stripe.subscriptions.retrieve(
        organization.subscription.stripeSubscriptionId,
        { expand: ['discounts'] },
      );
      const keep = current.discounts
        .filter((entry): entry is Stripe.Discount => typeof entry !== 'string')
        .filter((discount) => {
          const coupon = discount.source.coupon;
          const couponId = typeof coupon === 'string' ? coupon : coupon?.id;
          return couponId !== grant.stripeCouponId;
        })
        .map((discount) => ({ discount: discount.id }));
      await stripe.subscriptions.update(organization.subscription.stripeSubscriptionId, {
        // An empty string clears all discounts; an array replaces them.
        discounts: keep.length > 0 ? keep : '',
      });
    }
  } catch (error) {
    if (error instanceof Stripe.errors.StripeError) throw new InvalidRequestError(error.message);
    throw error;
  }

  await prisma.billingDiscountGrant.update({
    where: { id: grantId },
    data: { revokedAt: new Date() },
  });
  await audit(organizationId, actor, 'admin.billing.discount_revoke', grantId, {
    label: describeGrant(shapeOf(grant)),
  });
  if (organization.subscription)
    await syncSubscriptionById(organization.subscription.stripeSubscriptionId);
}

// --- Promotion codes (customer-entered, platform wide) ---------------------------------

export interface AdminPromotionCode {
  id: string;
  code: string;
  active: boolean;
  label: string;
  couponName: string | null;
  timesRedeemed: number;
  maxRedemptions: number | null;
  expiresAt: string | null;
  firstTimeOnly: boolean;
  createdAt: string;
  /** Customer-restricted codes are admin grants (managed on the organisation), not campaign codes. */
  restrictedToCustomer: boolean;
  stripeUrl: string;
}

function couponLabel(coupon: Stripe.Coupon): string {
  const amount = coupon.percent_off
    ? `${coupon.percent_off}% off`
    : `$${((coupon.amount_off ?? 0) / 100).toFixed(2)} off`;
  if (coupon.duration === 'forever') return `${amount} forever`;
  if (coupon.duration === 'once') return `${amount} once`;
  const months = coupon.duration_in_months ?? 0;
  return `${amount} for ${months} ${months === 1 ? 'month' : 'months'}`;
}

function toAdminPromotionCode(code: Stripe.PromotionCode): AdminPromotionCode {
  const coupon = code.promotion.coupon;
  const couponObject = coupon && typeof coupon !== 'string' ? coupon : null;
  return {
    id: code.id,
    code: code.code,
    active: code.active,
    label: couponObject ? couponLabel(couponObject) : '',
    couponName: couponObject?.name ?? null,
    timesRedeemed: code.times_redeemed,
    maxRedemptions: code.max_redemptions,
    expiresAt: code.expires_at ? new Date(code.expires_at * 1000).toISOString() : null,
    firstTimeOnly: code.restrictions.first_time_transaction,
    createdAt: new Date(code.created * 1000).toISOString(),
    restrictedToCustomer: !!code.customer,
    stripeUrl: stripeDashboardUrl(`promotion_codes/${code.id}`),
  };
}

export async function listPromotionCodes(): Promise<AdminPromotionCode[]> {
  const codes = await getStripe().promotionCodes.list({
    limit: 100,
    expand: ['data.promotion.coupon'],
  });
  return codes.data.filter((code) => !code.customer).map(toAdminPromotionCode);
}

export async function createPromotionCode(
  input: PromotionCodeInput,
  actor: AdminActor,
): Promise<AdminPromotionCode> {
  const stripe = getStripe();
  try {
    const coupon = await stripe.coupons.create({
      name: input.name,
      ...(input.percentOff != null
        ? { percent_off: input.percentOff }
        : { amount_off: input.amountCents, currency: 'aud' }),
      duration: input.duration,
      ...(input.duration === 'repeating' ? { duration_in_months: input.durationMonths } : {}),
      metadata: { createdBy: actor.email },
    });
    const code = await stripe.promotionCodes.create({
      promotion: { type: 'coupon', coupon: coupon.id },
      code: input.code,
      ...(input.maxRedemptions ? { max_redemptions: input.maxRedemptions } : {}),
      ...(input.expiresOn ? { expires_at: endOfDayUnix(input.expiresOn) } : {}),
      restrictions: { first_time_transaction: input.firstTimeOnly },
      metadata: { createdBy: actor.email },
      expand: ['promotion.coupon'],
    });
    log.info('admin.promotion_code_created', {
      promotionCode: code.code,
      actorEmail: actor.email,
    });
    return toAdminPromotionCode(code);
  } catch (error) {
    if (error instanceof Stripe.errors.StripeError) throw new InvalidRequestError(error.message);
    throw error;
  }
}

export async function setPromotionCodeActive(
  promotionCodeId: string,
  active: boolean,
  actor: AdminActor,
): Promise<void> {
  try {
    await getStripe().promotionCodes.update(promotionCodeId, { active });
    log.info('admin.promotion_code_updated', {
      promotionCodeId,
      active,
      actorEmail: actor.email,
    });
  } catch (error) {
    if (error instanceof Stripe.errors.StripeError) throw new InvalidRequestError(error.message);
    throw error;
  }
}
