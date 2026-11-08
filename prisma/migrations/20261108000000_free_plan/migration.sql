-- Permanent Free plan (specs/08-billing.md). Existing organisations keep their current plan;
-- new self-service signups start on `free`. The value is only added here, never used in this
-- migration, so it is safe inside Prisma's migration transaction.
ALTER TYPE "org_plan" ADD VALUE IF NOT EXISTS 'free' BEFORE 'standard';
