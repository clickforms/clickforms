import type { BillingInterval, BillingMode, OrgPlan } from '@prisma/client';
import type { BillingAccess } from '@/lib/billing/status';

// Client-safe shapes passed from server pages to the billing UI.

/** Display-only snapshot of the active discount, stored as OrgSubscription.discountSummary. */
export interface DiscountSummary {
  name: string | null;
  percentOff: number | null;
  /** Fixed amount off, in cents. */
  amountOff: number | null;
  currency: string | null;
  /** ISO timestamp when the discount stops applying; null for `forever`. */
  endsAt: string | null;
}

export interface BillingSubscriptionInfo {
  stripeStatus: string;
  plan: OrgPlan;
  interval: BillingInterval;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  /** Whole days left of the payment-retry grace period; null unless past due. */
  graceDaysLeft: number | null;
  discount: DiscountSummary | null;
}

export interface BillingInfo {
  /** False on environments without Stripe keys (local dev): plan changes fall back to the
   * old free switch there. */
  stripeEnabled: boolean;
  billingMode: BillingMode;
  access: BillingAccess;
  subscription: BillingSubscriptionInfo | null;
}

/** Card on file, as shown on the Billing tab. Never contains the full number. */
export type BillingPaymentMethod =
  | { type: 'card'; brand: string; last4: string; expMonth: number; expYear: number }
  /** Saved through Stripe Link: Stripe exposes only the account email, not the card. */
  | { type: 'link'; email: string | null };

export interface BillingInvoiceSummary {
  id: string;
  number: string | null;
  /** ISO timestamp. */
  createdAt: string;
  amountCents: number;
  currency: string;
  /** Stripe invoice status: open | paid | void | uncollectible. Drafts are never listed. */
  status: string;
  hostedInvoiceUrl: string | null;
  pdfUrl: string | null;
}

/** Live Stripe data for the Billing tab, fetched on demand (not on every page load). */
export interface BillingDetails {
  paymentMethod: BillingPaymentMethod | null;
  invoices: BillingInvoiceSummary[];
}
