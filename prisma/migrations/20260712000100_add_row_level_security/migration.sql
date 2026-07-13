-- Clickforms — Row-Level Security (ARCHITECTURE.md §4, specs/01-data-model-and-auth.md).
--
-- HAND-WRITTEN for the same reason as the init migration: Prisma has no `CREATE POLICY`
-- primitive, so RLS is never something `prisma migrate dev` would generate on its own —
-- this file is exactly the kind of manual addition the Prisma docs recommend for RLS,
-- just authored ahead of a live migrate run rather than appended after one.
--
-- Model: every tenant-scoped table is filtered by comparing its `organization_id` column
-- (or, for `organizations` itself, its own `id`) against `current_setting('app.current_org_id')`
-- — a Postgres session variable set per request. See src/lib/db.ts `withOrgContext()`,
-- which wraps every org-scoped query in a transaction that runs
-- `SET LOCAL app.current_org_id = '<uuid>'` before the real query — `SET LOCAL` scopes the
-- setting to the current transaction only, so it can never leak across pooled connections.
--
-- Deviation from the literal spec wording: policies use
-- `current_setting('app.current_org_id', true)` — the second (`missing_ok`) argument makes
-- an unset session variable evaluate to SQL NULL instead of raising an error. Since
-- `organization_id = NULL` is NULL (falsy) in SQL, a request that forgets to set the
-- session variable sees zero rows rather than getting an application-crashing exception —
-- fails closed either way, but degrades to "no data" instead of a 500.
--
-- IMPORTANT — RLS is bypassed entirely for superusers and any role with BYPASSRLS. RDS's
-- default master user is a superuser. Before relying on these policies in production,
-- create a dedicated least-privilege application role (NOSUPERUSER, NOBYPASSRLS) and
-- point DATABASE_URL at it — the master user should only be used for
-- `prisma migrate deploy`, not for the app's runtime connection.
--
-- `FORCE ROW LEVEL SECURITY` is required in addition to `ENABLE ROW LEVEL SECURITY` —
-- without FORCE, RLS is skipped for the table owner (the role migrations run as, which
-- for a single-role setup is also the app's runtime role).

-- organizations: a session may only see its own organization row.
ALTER TABLE "organizations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "organizations" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "organizations"
  USING ("id" = current_setting('app.current_org_id', true)::uuid);

-- users
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "users" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "users"
  USING ("organization_id" = current_setting('app.current_org_id', true)::uuid);

-- forms
ALTER TABLE "forms" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "forms" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "forms"
  USING ("organization_id" = current_setting('app.current_org_id', true)::uuid);

-- form_versions
ALTER TABLE "form_versions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "form_versions" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "form_versions"
  USING ("organization_id" = current_setting('app.current_org_id', true)::uuid);

-- submissions
ALTER TABLE "submissions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "submissions" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "submissions"
  USING ("organization_id" = current_setting('app.current_org_id', true)::uuid);

-- submission_files
ALTER TABLE "submission_files" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "submission_files" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "submission_files"
  USING ("organization_id" = current_setting('app.current_org_id', true)::uuid);

-- signatures
ALTER TABLE "signatures" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "signatures" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "signatures"
  USING ("organization_id" = current_setting('app.current_org_id', true)::uuid);

-- workflow_steps
ALTER TABLE "workflow_steps" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "workflow_steps" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "workflow_steps"
  USING ("organization_id" = current_setting('app.current_org_id', true)::uuid);

-- audit_log
ALTER TABLE "audit_log" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_log" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "audit_log"
  USING ("organization_id" = current_setting('app.current_org_id', true)::uuid);
