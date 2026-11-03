-- One-time email codes for two-step sign-in (and for confirming enrolment in it). Only a
-- keyed hash of the 6-digit code is stored. No organization_id / RLS, same as
-- password_reset_tokens: codes are created and checked at sign-in, before any organisation
-- context exists.

CREATE TABLE "two_factor_codes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "purpose" TEXT NOT NULL,
    "code_hash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "two_factor_codes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "two_factor_codes_user_id_purpose_idx" ON "two_factor_codes"("user_id", "purpose");

ALTER TABLE "two_factor_codes" ADD CONSTRAINT "two_factor_codes_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
