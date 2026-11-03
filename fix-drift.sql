-- One-off fix for local dev DB drift: an orphaned "form import" feature (columns +
-- enum) was applied to this database at some point but never committed to
-- prisma/migrations/ or prisma/schema.prisma — no trace of it anywhere in git history.
-- This removes just that drift so `prisma migrate dev` can proceed without wiping the
-- whole dev database via `prisma migrate reset`. Safe to delete this file afterwards.

ALTER TABLE forms DROP COLUMN IF EXISTS import_status;
ALTER TABLE forms DROP COLUMN IF EXISTS import_error;
ALTER TABLE forms DROP COLUMN IF EXISTS source_document_storage_key;

ALTER TABLE form_templates DROP COLUMN IF EXISTS import_status;
ALTER TABLE form_templates DROP COLUMN IF EXISTS import_error;
ALTER TABLE form_templates DROP COLUMN IF EXISTS source_document_storage_key;

DROP TYPE IF EXISTS form_import_status;

DELETE FROM _prisma_migrations
WHERE migration_name IN ('20260921000000_add_form_import', '20260921010000_add_form_template_import');
