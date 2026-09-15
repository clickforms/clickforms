-- Clickforms admin area (specs/06-admin-dashboard.md follow-up): platform staff need a
-- way to onboard and manage every organisation, which is a different axis of authority
-- from `users.role` (always scoped to the user's own organization — see
-- src/lib/user-roles.ts). Adding a single boolean flag rather than a new UserRole value
-- keeps every existing role check ("is this user an admin of their org") unchanged; only
-- src/lib/session.ts's new requirePlatformAdmin() reads this column.
ALTER TABLE "users" ADD COLUMN "is_platform_admin" BOOLEAN NOT NULL DEFAULT false;
