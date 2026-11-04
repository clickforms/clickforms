-- Prefill review: a response that comes back through a prefill link can be held in the Prefills
-- tab until staff promote it to a normal response. Held responses keep status 'in_progress' (so
-- every existing Responses list / count / export already excludes them) and are flagged here.
ALTER TABLE "submissions" ADD COLUMN "prefill_held" BOOLEAN NOT NULL DEFAULT false;

-- Per-form switch: hold responses that come back through a prefill for review (default on).
ALTER TABLE "forms" ADD COLUMN "hold_prefilled_responses" BOOLEAN NOT NULL DEFAULT true;
