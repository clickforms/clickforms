-- Per-form PDF download naming (Settings tab, src/app/forms/[id]/settings). Nullable —
-- unset means keep the existing default filename (form-name-2026-09-08.pdf).
ALTER TABLE "forms" ADD COLUMN "pdf_filename_template" TEXT;
