-- SMS counterpart to email_log, for the new "send this live form via SMS" share flow
-- (src/lib/sms.ts, POST /api/forms/[id]/share). Reuses the existing email_status enum
-- rather than adding an identical sms_status one, since "sent / failed / dev_logged"
-- means the same thing regardless of channel.

CREATE TABLE "sms_log" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID,
    "to_phone" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "status" "email_status" NOT NULL,
    "provider_message_id" TEXT,
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sms_log_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "sms_log_organization_id_idx" ON "sms_log"("organization_id");
CREATE INDEX "sms_log_kind_idx" ON "sms_log"("kind");
CREATE INDEX "sms_log_created_at_idx" ON "sms_log"("created_at");

ALTER TABLE "sms_log" ADD CONSTRAINT "sms_log_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
