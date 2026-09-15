-- Delivery bookkeeping for every sendEmail() call (src/lib/email.ts) — signup
-- verification, invites, password reset, submission notifications, the public contact
-- form, and anything added later. This is a log, not a queue: sendEmail() calls the
-- provider (Resend) synchronously and writes one row per attempt afterward.

CREATE TYPE "email_status" AS ENUM ('sent', 'failed', 'dev_logged');

CREATE TABLE "email_log" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID,
    "to_email" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "status" "email_status" NOT NULL,
    "provider_message_id" TEXT,
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_log_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "email_log_organization_id_idx" ON "email_log"("organization_id");
CREATE INDEX "email_log_kind_idx" ON "email_log"("kind");
CREATE INDEX "email_log_created_at_idx" ON "email_log"("created_at");

ALTER TABLE "email_log" ADD CONSTRAINT "email_log_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- No Row-Level Security here, same reasoning as password_reset_tokens/pending_signups:
-- organization_id is nullable (plenty of sends happen before any org exists, or aren't
-- org-scoped at all) and sendEmail() is called from both inside and outside an org's
-- withOrgContext transaction, so this is always read/written through the plain `prisma`
-- client.
