-- "Save and complete later" in the admin prefill builder: a half-filled prefill kept as a draft
-- (never reachable through its link, never emailed) until the admin finishes and sends it.
ALTER TABLE "form_prefills" ADD COLUMN "is_draft" BOOLEAN NOT NULL DEFAULT false;
