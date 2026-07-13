-- Step 1 of self-service signup: a PendingSignup row captures org/contact details
-- before any Organization/User exists. See src/app/api/auth/signup/route.ts (creates
-- the row + emails the verify link) and src/app/api/auth/signup/verify/route.ts
-- (consumes it to create the real Organization + User).

CREATE TYPE "signup_form_situation" AS ENUM ('paper_form', 'existing_online_form', 'no_form');

CREATE TABLE "pending_signups" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_name" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "form_situation" "signup_form_situation" NOT NULL,
    "terms_accepted_at" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pending_signups_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "pending_signups_token_key" ON "pending_signups"("token");
CREATE UNIQUE INDEX "pending_signups_email_key" ON "pending_signups"("email");

-- No Row-Level Security here, unlike every other table in this schema: pending_signups
-- has no organization_id because the whole point of the row is that no Organization
-- exists yet. It's looked up and written exclusively through the plain `prisma` client
-- (never withOrgContext), the same way UserInvite is looked up pre-acceptance — see
-- src/app/api/invites/[token]/route.ts for the precedent.
