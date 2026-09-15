-- Which field's answer backs the `{prefix}` token in a form's PDF filename template
-- (Settings tab, src/app/forms/[id]/settings). Stores a field id from the form's current
-- FormVersion.schema JSONB — not a real foreign key, since that field lives in JSON, not
-- its own table. Nullable — unset means no prefix token is configured.
ALTER TABLE "forms" ADD COLUMN "filename_prefix_field_id" TEXT;
