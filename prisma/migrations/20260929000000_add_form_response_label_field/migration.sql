-- Which field's answer is shown in the first column of a form's Responses list (Settings tab).
-- Field id from the current FormVersion.schema JSONB, not a real foreign key. NULL = automatic
-- (best-effort name/email).
ALTER TABLE "forms" ADD COLUMN "response_label_field_id" TEXT;
