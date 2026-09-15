-- Submission notification emails: an org-wide default recipient plus an optional
-- per-form override (see prisma/schema.prisma doc comments on Organization.notificationEmail
-- and Form.notificationMode/notificationEmail).

-- CreateEnum
CREATE TYPE "form_notification_mode" AS ENUM ('org_default', 'custom', 'off');

-- AlterTable
ALTER TABLE "organizations"
  ADD COLUMN "notification_email" TEXT;

-- AlterTable
ALTER TABLE "forms"
  ADD COLUMN "notification_mode" "form_notification_mode" NOT NULL DEFAULT 'org_default',
  ADD COLUMN "notification_email" TEXT;
