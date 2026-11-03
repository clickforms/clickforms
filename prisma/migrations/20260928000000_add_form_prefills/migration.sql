-- Admin-created "prefills": a form with some answers pre-populated, emailed to one recipient
-- via an unguessable token link. Listed per form under Prefills; responses that come back
-- through one are linked to it (submissions.prefill_id) and keep a snapshot of who it was
-- sent to (submissions.prefill_recipient) so the "from a prefill" marker survives the prefill
-- being deleted — deleting a prefill never deletes its responses.

CREATE TABLE "form_prefills" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "form_id" UUID NOT NULL,
    "created_by" UUID,
    "recipient_email" TEXT NOT NULL,
    "recipient_name" TEXT,
    "token" TEXT NOT NULL,
    "answers" JSONB NOT NULL DEFAULT '{}',
    "sent_at" TIMESTAMP(3),
    "opened_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "form_prefills_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "form_prefills_token_key" ON "form_prefills"("token");
CREATE INDEX "form_prefills_organization_id_idx" ON "form_prefills"("organization_id");
CREATE INDEX "form_prefills_form_id_idx" ON "form_prefills"("form_id");

ALTER TABLE "form_prefills" ADD CONSTRAINT "form_prefills_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "form_prefills" ADD CONSTRAINT "form_prefills_form_id_fkey"
    FOREIGN KEY ("form_id") REFERENCES "forms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "form_prefills" ADD CONSTRAINT "form_prefills_created_by_fkey"
    FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "form_prefills" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "form_prefills" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "form_prefills"
  USING ("organization_id" = current_setting('app.current_org_id', true)::uuid);

ALTER TABLE "submissions" ADD COLUMN "prefill_id" UUID;
ALTER TABLE "submissions" ADD COLUMN "prefill_recipient" TEXT;
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_prefill_id_fkey"
    FOREIGN KEY ("prefill_id") REFERENCES "form_prefills"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "submissions_prefill_id_idx" ON "submissions"("prefill_id");
