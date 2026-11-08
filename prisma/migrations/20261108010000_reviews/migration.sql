-- Customer reviews from the public /review page, moderated in the platform-admin console.
-- Not tenant data: no organisation_id and no RLS (like billing_discount_grants).

CREATE TYPE "review_status" AS ENUM ('pending', 'approved', 'hidden');

CREATE TABLE "reviews" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "name" TEXT NOT NULL,
  "company" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "role" TEXT,
  "rating" INTEGER,
  "email" TEXT,
  "consent_to_publish" BOOLEAN NOT NULL,
  "status" "review_status" NOT NULL DEFAULT 'pending',
  "ip_hash" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "moderated_at" TIMESTAMP(3),
  "moderated_by_email" TEXT,

  CONSTRAINT "reviews_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "reviews_rating_range" CHECK ("rating" IS NULL OR ("rating" >= 1 AND "rating" <= 5))
);

CREATE INDEX "reviews_status_created_at_idx" ON "reviews"("status", "created_at");
CREATE INDEX "reviews_ip_hash_created_at_idx" ON "reviews"("ip_hash", "created_at");
