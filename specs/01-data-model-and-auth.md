# Spec 01 — Data Model & Auth

Depends on: 00-infrastructure (needs a reachable RDS instance).
Blocks: 02, 03, 04, 05, 06 — all of them touch this schema.

## Goal

Prisma schema matching ARCHITECTURE.md §4, migrated onto RDS, with Row-Level Security enforced, Auth.js wired up for admin login, and a seed script that creates the one default organization plus an admin user.

## Scope

- **Prisma schema**: `organizations`, `users`, `forms`, `form_versions`, `submissions`, `submission_files`, `signatures`, `audit_log` tables exactly as specified in ARCHITECTURE.md §4. `workflow_steps` table created but unused until spec 07.
- **RLS policies**: every table gets a policy `USING (organization_id = current_setting('app.current_org_id')::uuid)`. A Prisma middleware (or a thin query wrapper) sets `app.current_org_id` at the start of every request from the session, before any query runs.
- **Auth.js**: credentials provider (email + bcrypt password hash) to start; magic-link can be added later without schema changes. Session includes `userId`, `organizationId`, `role`.
- **Roles**: `admin` (full access), `editor` (create/edit forms, view submissions), `viewer` (view submissions only) — enforced in API route handlers, not just UI hiding.
- **Seed script**: creates one default organization, one admin user, runs on first deploy only (idempotent — safe to re-run).
- **Audit logging helper**: a single `logAudit(action, entityType, entityId, metadata)` function called from mutating routes, writing to `audit_log`. Wire this in now so every later spec just calls it rather than inventing its own logging.

## Out of scope

SSO, 2FA, org invite flow, org switcher — all deferred to §7 (multi-tenant conversion), not needed with one org and a handful of known users.

## Acceptance criteria

- `yarn prisma migrate deploy` runs clean against RDS from CI.
- Logging in as the seeded admin sets a session; hitting any `/api/*` route without a session returns 401.
- A manual test: temporarily hardcode a second `organization_id` in a query and confirm RLS blocks it even though the application code "forgot" to filter — proves DB-layer enforcement actually works, not just app-layer discipline.
- `audit_log` has a row after creating a test form.
