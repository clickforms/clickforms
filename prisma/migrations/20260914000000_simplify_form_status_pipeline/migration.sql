-- Collapses the draft -> approved -> published pipeline to draft -> published.
-- The 'approved' enum value is left in place in Postgres (removing an enum value is
-- risky/non-trivial and unnecessary) but is no longer written by the app going forward —
-- see src/lib/forms/form-workflow.ts and src/lib/forms/form-status.ts.
UPDATE "forms" SET "status" = 'draft' WHERE "status" = 'approved';
