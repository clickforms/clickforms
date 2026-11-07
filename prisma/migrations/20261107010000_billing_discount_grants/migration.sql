-- Admin-granted discounts and credit (specs/08-billing.md, Phase 2). Stripe holds the coupon /
-- promotion code / customer balance; this table is the admin-facing history.

CREATE TYPE "discount_grant_kind" AS ENUM ('percent', 'amount', 'free_months', 'credit');
CREATE TYPE "discount_duration" AS ENUM ('once', 'repeating', 'forever');

CREATE TABLE "billing_discount_grants" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,
  "kind" "discount_grant_kind" NOT NULL,
  "value" INTEGER NOT NULL,
  "duration" "discount_duration",
  "duration_months" INTEGER,
  "stripe_coupon_id" TEXT,
  "stripe_promotion_code_id" TEXT,
  "stripe_balance_txn_id" TEXT,
  "reason" TEXT NOT NULL,
  "granted_by" UUID NOT NULL,
  "granted_by_email" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "applied_at" TIMESTAMP(3),
  "revoked_at" TIMESTAMP(3),

  CONSTRAINT "billing_discount_grants_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "billing_discount_grants_organization_id_created_at_idx"
  ON "billing_discount_grants"("organization_id", "created_at");

ALTER TABLE "billing_discount_grants"
  ADD CONSTRAINT "billing_discount_grants_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
