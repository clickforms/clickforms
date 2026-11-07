# 08: Billing and paywall (Stripe)

Status: Phases 1 and 2 built (Checkout, Portal, webhook, enforcement, billing UI; platform-admin billing tools). Phase 3 pending. Replaces the manual `plan` / `status` / `renewsAt` handling described in
`06-admin-dashboard.md`.

## Decisions (from product owner)

- Provider: Stripe Billing, AUD, hosted Checkout and Customer Portal (no card data touches our servers).
- 7-day trial, **no card up front**. At trial end the org hits the paywall and must subscribe.
- Prices are **GST-inclusive** everywhere (pricing page, checkout, invoices). Invoices show the GST portion.
- Intervals: monthly and annual. Annual = **10% off** the 12-month total, billed upfront. UI shows both the
  monthly price and the annual total.
- Failed payment: grace period (Stripe retries ~14 days, with emails), then the org becomes read-only.
  Public forms keep accepting responses while an org is read-only.
- Admin must be able to grant discounts, for example 20% off for 2 months, free months and credit.

## Prices (GST-inclusive, AUD)

| Plan | Monthly | Annual total (10% off) | Annual per month |
|---|---|---|---|
| Standard | $82.00 | $885.60 | $73.80 |
| Business | $129.00 | $1,393.20 | $116.10 |
| Professional | $219.00 | $2,365.20 | $197.10 |
| Enterprise | custom | custom | invoice-based, set by admin |

Source of truth stays `PLAN_PRICING` in `src/lib/admin/plan-limits.ts` (to be updated); Stripe Prices are
created from it with lookup keys `standard_monthly`, `standard_annual`, etc., `tax_behavior: inclusive`,
and a 10% GST tax rate (switch to Stripe Tax once GST registration is configured in Stripe).

## Architecture

- **Stripe is the source of truth** for subscription state. We mirror it into Postgres from webhooks.
  Nothing trusts a Checkout redirect.
- Subscribe: `POST /api/billing/checkout` `{ plan, interval, promotionCode? }` creates a Checkout Session
  (`mode: subscription`, `allow_promotion_codes`, billing address and ABN collection, `metadata.orgId`).
- Manage: `POST /api/billing/portal` opens the Customer Portal (card, invoices, cancel).
- Plan change (`POST /api/billing/change-plan`): applies immediately with `proration_behavior: always_invoice`, so an upgrade is charged for the rest of the period straight away and a downgrade is credited on the next invoice. A downgrade is refused while the org is over the lower plan's limits. (Deviation from the original idea of downgrading at period end, which needs Subscription Schedules; can be added later.) The Customer Portal has plan switching disabled for this reason.
- Webhook: `POST /api/billing/webhook` on the root domain (exempt from tenant middleware), raw-body signature
  verification, idempotent via `billing_events.stripe_event_id` unique.
  Events: `checkout.session.completed`, `customer.subscription.created|updated|deleted`, `invoice.paid`,
  `invoice.payment_failed`, `customer.discount.created|updated|deleted`.
- Webhook handlers have no org session, so they use the same system-level DB path as other background
  work (not `withOrgContext`), scoped by `stripeCustomerId`.

## Data model

- `Organization`: add `stripeCustomerId` (unique, nullable), `billingMode` (`manual | stripe`, default
  `manual`). Existing orgs stay `manual` so nothing is locked at cutover; an admin converts them.
- `OrgStatus` is unchanged (`active | trial | suspended`). Payment state lives in `org_subscriptions.stripe_status` and is interpreted by `getBillingAccess()` in `src/lib/billing/status.ts`, so the admin status controls keep their meaning.
- `org_subscriptions`: `organization_id` (unique), `stripe_subscription_id`, `stripe_status`, `plan`,
  `interval`, `current_period_end`, `cancel_at_period_end`, `past_due_since`, `discount_summary` (json:
  coupon name, percent or amount, months remaining, ends at).
- `billing_events`: `stripe_event_id` (unique), `type`, `processed_at`, `payload` (json), `error`.
- `billing_discount_grants`: `organization_id`, `kind` (`percent | amount | free_months | credit`), `value`,
  `duration` (`once | repeating | forever`), `duration_months`, `stripe_coupon_id`,
  `stripe_promotion_code_id?`, `reason`, `granted_by` (platform admin), `created_at`, `revoked_at`,
  `applied_at` (null while pending, for orgs still in trial).

## Status mapping and enforcement

| Stripe state | Org status | Access |
|---|---|---|
| none, trial not ended | `trial` | full |
| none, trial ended | `trial` expired | read-only for org admins (existing `TrialExpiredError`) |
| `active` / `trialing` | `active` | full |
| `past_due` | `past_due` | full, banner and emails (grace period) |
| `unpaid` / `canceled` | `canceled` | read-only |
| admin action | `suspended` | blocked (unchanged) |

Read-only means no creating or editing forms, users or files. Viewing and exporting data and public
form submissions continue. Stripe is configured to retry for 14 days then mark the subscription `unpaid`.
`billingMode = manual` orgs skip all of this and keep current behaviour.

## Build notes (Phase 1)

- Subscriptions are created with `billing_mode: { type: 'flexible' }` (Stripe's recommended mode).
- Checkout accepts at most one coupon or promotion code, and `discounts` cannot be combined with
  `allow_promotion_codes`. Subscriptions themselves accept many discounts. So admin grants for an
  org that already subscribes are attached to the subscription directly, and a grant for an org
  still on trial is a customer-restricted promotion code (promotion codes, unlike coupons, can be
  limited to one customer) that is passed as the single Checkout discount.
- The Checkout success page re-syncs the subscription server-side as a safety net; the webhook is
  still the source of truth.
- With `STRIPE_AUTOMATIC_TAX=true` Checkout uses Stripe Tax (needs GST registration added in
  Stripe). Until then `STRIPE_GST_TAX_RATE_ID` (an inclusive 10% tax rate) keeps GST itemised.
- Only cards should be enabled for subscriptions in Stripe's payment method settings (Klarna and
  similar are enabled by default in new sandboxes).
- `yarn billing:setup-prices` creates the products, prices and Customer Portal configuration
  idempotently (run once per Stripe account, test first, then live).

## Build notes (Phase 2, platform admin)

- Organisation page (`/admin/organisations/[id]`) has a Billing panel (`org-billing-panel.tsx`):
  subscription summary, live invoices from Stripe, discounts and credit, cancel at period end /
  resume / cancel now, "Open in Stripe" links.
- **Manual payment recovery**: an open invoice shows **Retry payment** (`stripe.invoices.pay`), **Mark
  paid** (paid out of band, for bank transfers) and **Void**. A declined card returns 200 with
  `ok:false` and Stripe's message; the subscription is re-synced straight after so `past_due` /
  `active` shows without waiting for the webhook. The invoice must belong to the organisation's own
  Stripe customer.
- **Grants** (`billing_discount_grants`): percent, dollar amount, free months (100% repeating coupon)
  and account credit (negative customer balance transaction). With a live subscription the coupon is
  attached to it immediately (existing discounts are kept). Otherwise it becomes a promotion code
  restricted to that customer; Checkout applies it automatically and then hides the
  promotion-code box (Checkout allows only one discount). The sync marks a grant applied when its
  coupon appears on the subscription. Revoking removes the discount from future invoices; credit
  cannot be revoked in-app because it may be partly spent.
- Stripe objects use idempotency keys derived from the grant id, so a retried request cannot create
  two coupons or two credits.
- For Stripe-billed organisations the manual Plan & trial form is replaced by a note, and
  `PATCH /api/admin/organizations/[id]` refuses plan, trial and renewal edits (suspend and
  reactivate still work).
- `/admin/billing/promotions`: campaign promotion codes (percent or amount, duration, max uses,
  expiry, new customers only), activate/deactivate. Codes are never deleted.
- Every mutation writes an audit log entry (`admin.billing.*`) with the actor and reason.

## Build notes (customer billing UI)

- **Billing tab** (`billing-tab.tsx`): dark Current subscription panel (plan, status, included-in-plan
  checklist, price, next invoice or trial end, billing interval, discount) with actions (switch billing
  cycle, change plan, manage subscription); Billing information (card on file, link to business
  details); invoice history with hosted-invoice and PDF links; usage meters.
- Card and invoices are fetched on demand from `GET /api/billing/details` (admin only, read live from
  Stripe), not during page render, so a slow Stripe never delays the settings page.
- **Change plan** (`/forms/organisation/plan`): plan cards with the selected one filled, a compare
  features table, and a sticky confirm bar. `?interval=month|year` preselects the toggle.

## Discounts (admin)

All in `/admin/billing`, all written to the audit log with a reason.

- **Coupons**: percent or fixed amount, duration `once | repeating (N months) | forever`, optional max
  redemptions, expiry, and restriction to specific plans.
- **Promotion codes**: customer-entered codes at checkout, with expiry, redemption limit, first-time
  customers only, and a minimum amount.
- **Per-organisation grant**: "20% off for 2 months for Org X". If the org has a subscription the coupon is
  attached to it immediately; if it is still in trial the grant is stored as pending and applied at
  Checkout. Revoking removes the discount from future invoices.
- **Free months and credit**: free months are a 100% repeating coupon; credit uses the Stripe customer
  balance.
- **Custom price (Enterprise)**: invoice-based subscription with an admin-set price
  (`collection_method: send_invoice`).
- Stacking: Stripe supports multiple discounts on a subscription; verify the API version at build time and
  cap at one active coupon plus one promotion code unless the owner wants more.

## Customer-facing UI (Organisation > Billing)

Current plan and interval, next invoice date and amount (GST-inclusive), applied discount with remaining
months ("20% off, 1 of 2 months left"), invoice list (hosted invoice links), manage payment method (Portal),
change plan, cancel. Banners for trial ending (day 5 and 7), payment failed, and read-only state.

## Admin console

`/admin/billing`: MRR (after discounts), subscribers by plan and status, failed payments list, discounts
granted. Organisation detail: subscription, discount history, "open in Stripe".

## Emails (Resend)

Payment failed (with Portal link), trial ending, subscription canceled, read-only notice. Stripe sends the
receipts and tax invoices (enable in Stripe settings).

## Secrets and config

`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` in Infisical per environment (test keys in `dev` and `staging`,
live in `prod` only). Add both to the `environment:` list in `docker-compose.yml`. Prices are resolved by
lookup key, so no price IDs in config.

## Testing

Stripe test mode with `stripe listen --forward-to localhost:3000/api/billing/webhook`; unit tests for status
mapping, grace logic and discount-grant rules; webhook idempotency test (same event twice); a manual script
to create the test Products and Prices.

## Phases

1. **Core paywall**: schema, Stripe Prices script, Checkout, Portal, webhook, status mapping, enforcement,
   Organisation Billing tab, past-due and trial banners, `billingMode` rollout.
2. **Admin discounts**: coupons, promotion codes, per-organisation grants, credit and free months, audit
   log, discount display for customers.
3. **Polish**: Resend emails, MRR and failed-payment views, annual toggle on `/pricing`, Enterprise
   invoice flow, docs.

## Open questions

- GST registration: confirm the business is registered so Stripe Tax can be enabled.
- Cancellation policy: cancel at period end (default) or allow immediate cancel with prorated refund?
- Should existing orgs on manual billing be given a migration deadline?
