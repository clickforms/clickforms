-- Send back for correction: a returned response can be sent back to the same person as a new
-- prefill (their answers pre-filled) that stays tied to the original prefill via parent_id.
ALTER TABLE "form_prefills" ADD COLUMN "parent_id" UUID REFERENCES "form_prefills"("id") ON DELETE CASCADE;
CREATE INDEX "form_prefills_parent_id_idx" ON "form_prefills"("parent_id");

-- Set on a held response once it has been sent back, so it is no longer "needs review".
ALTER TABLE "submissions" ADD COLUMN "sent_back_at" TIMESTAMP(3);
