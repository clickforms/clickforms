-- Platform admins (Clickforms staff) are not members of a customer organisation.
-- `organization_id` stays required for every org-scoped user; it is null only for
-- users with is_platform_admin = true who work in /admin.
ALTER TABLE "users" ALTER COLUMN "organization_id" DROP NOT NULL;

-- Postgres unique constraints treat NULLs as distinct, so (NULL, email) would otherwise
-- allow duplicate platform-admin emails. One platform-admin row per email.
CREATE UNIQUE INDEX "users_platform_admin_email_key"
  ON "users" ("email")
  WHERE "organization_id" IS NULL;

-- Login and /admin look up these rows without an app.current_org_id (see src/lib/auth.ts).
-- Tenant isolation still applies to every org-scoped user; this extra policy only
-- exposes rows that are deliberately unscoped.
CREATE POLICY "platform_admin_unscoped" ON "users"
  USING ("organization_id" IS NULL AND "is_platform_admin" = true)
  WITH CHECK ("organization_id" IS NULL AND "is_platform_admin" = true);
