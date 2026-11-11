-- Per-user UI preferences (remembered list filters, ...), so they follow a person across
-- devices and login sessions. Additive: new table only. No organization_id / RLS, same as
-- two_factor_codes: always accessed by the signed-in user's own id.

CREATE TABLE "user_preferences" (
    "user_id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_preferences_pkey" PRIMARY KEY ("user_id", "key")
);

ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
