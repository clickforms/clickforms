-- Add member role, user names, and invite flow for org signup + user management.

ALTER TYPE "user_role" ADD VALUE IF NOT EXISTS 'member' BEFORE 'editor';

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "name" TEXT;

ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'member';

CREATE TABLE "user_invites" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "role" "user_role" NOT NULL,
    "token" TEXT NOT NULL,
    "invited_by_id" UUID NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "accepted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_invites_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "user_invites_token_key" ON "user_invites"("token");
CREATE UNIQUE INDEX "user_invites_organization_id_email_key" ON "user_invites"("organization_id", "email");
CREATE INDEX "user_invites_organization_id_idx" ON "user_invites"("organization_id");

ALTER TABLE "user_invites" ADD CONSTRAINT "user_invites_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_invites" ADD CONSTRAINT "user_invites_invited_by_id_fkey" FOREIGN KEY ("invited_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_invites" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "user_invites" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "user_invites"
  USING ("organization_id" = current_setting('app.current_org_id', true)::uuid);
