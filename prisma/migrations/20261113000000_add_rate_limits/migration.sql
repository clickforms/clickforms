-- Shared rate-limit counters so limits on public endpoints (signup) hold across every app
-- instance and survive restarts. Additive: new table only. No organization_id / RLS: these
-- endpoints run before any organisation context exists. `key` is a hash, not a raw address.

CREATE TABLE "rate_limits" (
    "key" TEXT NOT NULL,
    "window_start" TIMESTAMP(3) NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "rate_limits_pkey" PRIMARY KEY ("key")
);
