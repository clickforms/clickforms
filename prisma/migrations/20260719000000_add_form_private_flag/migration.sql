-- Adds the per-form "keep this private" opt-out (Forms list row action — see
-- src/app/forms/form-actions-menu.tsx and src/lib/user-roles.ts formsListWhere).
--
-- Default is org-wide visibility: every form defaults to `is_private = false`, so all
-- existing forms remain visible to the whole org exactly as before this migration. A
-- form's creator can flip this to true, which hides it from literally everyone else in
-- the org — including admins/editors, no override — enforced entirely in application
-- code (formsListWhere, assertFormViewAccess/assertFormEditAccess in
-- src/lib/form-access.ts). The existing "forms" RLS policy is org-scoped only (see the
-- RLS migration), so no policy changes are needed here.

ALTER TABLE "forms"
  ADD COLUMN "is_private" BOOLEAN NOT NULL DEFAULT false;
