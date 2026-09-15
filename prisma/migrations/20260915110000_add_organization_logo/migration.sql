-- Org branding logo, shown in the workspace sidebar in place of the default Clickforms
-- wordmark once uploaded (see src/app/forms/organisation and
-- src/app/forms/admin-sidebar.tsx). Nullable — no logo means the default brand mark
-- keeps showing. Covered by the existing "organizations" tenant_isolation RLS policy
-- (prisma/migrations/20260712000100_add_row_level_security), same as every other
-- Organization column — no new policy needed.

ALTER TABLE "organizations" ADD COLUMN "logo_storage_key" TEXT;
