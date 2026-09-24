-- The pricing model grew from 3 tiers (free/pro/enterprise) to 4 (standard/business/
-- professional/enterprise) — see src/lib/admin/plan-limits.ts and the public /pricing
-- page. Renaming in place rather than adding new values and dropping the old ones keeps
-- every existing organizations.plan value pointing at the same relative tier: an org that
-- was on `free` becomes `standard` (same forms/storage caps it already had), one on `pro`
-- becomes `business`. No org's access changes as a result of this migration — the actual
-- numeric limits per tier live in code (plan-limits.ts), not in this enum, and nothing
-- enforces them yet regardless (see that file's doc comment).
--
-- RENAME VALUE can't run in the same transaction as a statement that *uses* the renamed
-- value, but plain renames plus one ADD VALUE together are fine as long as nothing else
-- in this file references 'professional' — Prisma wraps each migration.sql in its own
-- transaction, and none of the statements below do that.
ALTER TYPE "org_plan" RENAME VALUE 'free' TO 'standard';
ALTER TYPE "org_plan" RENAME VALUE 'pro' TO 'business';
ALTER TYPE "org_plan" ADD VALUE IF NOT EXISTS 'professional' AFTER 'business';

ALTER TABLE "organizations" ALTER COLUMN "plan" SET DEFAULT 'standard';
