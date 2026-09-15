-- Platform admin console (specs follow-up): billing/lifecycle fields on organizations,
-- 2FA display + platform-admin permission level on users, and a dedicated invite table
-- for the /admin "Team" page. See prisma/schema.prisma doc comments on OrgPlan,
-- OrgStatus, PlatformAdminRole, and PlatformAdminInvite for the reasoning behind each.

-- CreateEnum
CREATE TYPE "org_plan" AS ENUM ('free', 'pro', 'enterprise');

-- CreateEnum
CREATE TYPE "org_status" AS ENUM ('active', 'trial', 'suspended');

-- CreateEnum
CREATE TYPE "platform_admin_role" AS ENUM ('super_admin', 'support');

-- AlterTable
ALTER TABLE "organizations"
  ADD COLUMN "plan" "org_plan" NOT NULL DEFAULT 'free',
  ADD COLUMN "status" "org_status" NOT NULL DEFAULT 'active',
  ADD COLUMN "trial_ends_at" TIMESTAMP(3),
  ADD COLUMN "renews_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "users"
  ADD COLUMN "two_factor_enabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "platform_admin_role" "platform_admin_role";

-- CreateTable
CREATE TABLE "platform_admin_invites" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" TEXT NOT NULL,
    "name" TEXT,
    "role" "platform_admin_role" NOT NULL,
    "token" TEXT NOT NULL,
    "invited_by_id" UUID NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "accepted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_admin_invites_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "platform_admin_invites_email_key" ON "platform_admin_invites"("email");

-- CreateIndex
CREATE UNIQUE INDEX "platform_admin_invites_token_key" ON "platform_admin_invites"("token");

-- AddForeignKey
ALTER TABLE "platform_admin_invites" ADD CONSTRAINT "platform_admin_invites_invited_by_id_fkey" FOREIGN KEY ("invited_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill: any existing platform admin (is_platform_admin = true) becomes a super_admin
-- under the new, finer-grained role column so the Team page has something to list.
UPDATE "users" SET "platform_admin_role" = 'super_admin' WHERE "is_platform_admin" = true;
