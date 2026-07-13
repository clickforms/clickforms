-- "Forgot password" flow: a short-lived, single-use token emailed to the user's
-- address. See src/app/api/auth/forgot-password/route.ts (creates the row + emails
-- the reset link) and src/app/api/auth/reset-password/route.ts (consumes it to set a
-- new password_hash on the user).

CREATE TABLE "password_reset_tokens" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "token" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "password_reset_tokens_token_key" ON "password_reset_tokens"("token");
CREATE INDEX "password_reset_tokens_user_id_idx" ON "password_reset_tokens"("user_id");

ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- No Row-Level Security here, same reasoning as pending_signups: this table has no
-- organization_id because it's looked up by token alone, before the request has proven
-- which user (and therefore which org) it's acting as. It's read/written exclusively
-- through the plain `prisma` client, never withOrgContext.
