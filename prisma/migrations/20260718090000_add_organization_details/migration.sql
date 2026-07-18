-- Adds org-profile fields surfaced on the new admin-only "Organisation Settings" page
-- (src/app/forms/settings/organisation, src/app/api/organization/route.ts). All four
-- columns are nullable with no default — every existing organization simply has these
-- as NULL until an admin fills them in; no backfill needed. RLS's existing
-- "organizations" tenant_isolation policy (see the RLS migration) already covers the
-- whole row, so no policy changes are needed for new columns on an already-RLS'd table.

ALTER TABLE "organizations"
  ADD COLUMN "abn" TEXT,
  ADD COLUMN "contact_name" TEXT,
  ADD COLUMN "contact_email" TEXT,
  ADD COLUMN "contact_phone" TEXT;
