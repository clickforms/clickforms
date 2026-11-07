-- Stripe billing (specs/08-billing.md): billing mode + customer id on organisations, a mirror of
-- each org's Stripe subscription, and an idempotency ledger for webhook events.

CREATE TYPE "billing_mode" AS ENUM ('manual', 'stripe');
CREATE TYPE "billing_interval" AS ENUM ('month', 'year');

-- Every existing organisation stays on manual billing, so nothing locks at cutover.
ALTER TABLE "organizations"
  ADD COLUMN "billing_mode" "billing_mode" NOT NULL DEFAULT 'manual',
  ADD COLUMN "stripe_customer_id" TEXT;

CREATE UNIQUE INDEX "organizations_stripe_customer_id_key" ON "organizations"("stripe_customer_id");

CREATE TABLE "org_subscriptions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,
  "stripe_subscription_id" TEXT NOT NULL,
  "stripe_status" TEXT NOT NULL,
  "plan" "org_plan" NOT NULL,
  "interval" "billing_interval" NOT NULL,
  "current_period_end" TIMESTAMP(3),
  "cancel_at_period_end" BOOLEAN NOT NULL DEFAULT false,
  "past_due_since" TIMESTAMP(3),
  "discount_summary" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "org_subscriptions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "org_subscriptions_organization_id_key" ON "org_subscriptions"("organization_id");
CREATE UNIQUE INDEX "org_subscriptions_stripe_subscription_id_key" ON "org_subscriptions"("stripe_subscription_id");

ALTER TABLE "org_subscriptions"
  ADD CONSTRAINT "org_subscriptions_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "billing_events" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "stripe_event_id" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "processed_at" TIMESTAMP(3),
  "error" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "billing_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "billing_events_stripe_event_id_key" ON "billing_events"("stripe_event_id");
CREATE INDEX "billing_events_created_at_idx" ON "billing_events"("created_at");
