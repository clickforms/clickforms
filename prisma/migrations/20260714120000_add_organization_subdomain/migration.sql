-- Clickforms — per-organization subdomains for public form pages.
--
-- Multi-tenant public forms need the URL itself to disambiguate which org a visitor
-- is filling a form in for (e.g. carecircle.clickforms.com.au), since Form.slug is
-- only unique per-org, not globally (see schema.prisma comment on forms.@@unique).
-- src/middleware.ts resolves this subdomain from the request hostname per-request.
--
-- HAND-WRITTEN (not `prisma migrate dev`-generated) to safely backfill existing
-- organizations with a derived subdomain before the NOT NULL + UNIQUE constraints
-- are applied — the same two-phase approach (add nullable -> backfill -> constrain)
-- used any time a NOT NULL column is added to a table that already has rows.

-- 1. Add the column nullable first so existing rows aren't rejected outright.
ALTER TABLE "organizations" ADD COLUMN "subdomain" TEXT;

-- 2. Backfill: derive a slug from each org's name (lowercase, non-alphanumeric runs
--    collapsed to a single hyphen, leading/trailing hyphens trimmed), then disambiguate
--    any duplicates by appending "-2", "-3", etc. in id order — mirrors the app-level
--    slugify()/uniqueSlug() helpers in src/lib/forms/slug.ts used for new signups.
WITH base_slugs AS (
  SELECT
    "id",
    NULLIF(
      TRIM(BOTH '-' FROM REGEXP_REPLACE(LOWER("name"), '[^a-z0-9]+', '-', 'g')),
      ''
    ) AS base_slug,
    ROW_NUMBER() OVER (ORDER BY "created_at", "id") AS rn
  FROM "organizations"
),
numbered AS (
  SELECT
    "id",
    COALESCE(base_slug, 'org') AS base_slug,
    ROW_NUMBER() OVER (PARTITION BY COALESCE(base_slug, 'org') ORDER BY rn) AS dupe_rank
  FROM base_slugs
)
UPDATE "organizations" AS o
SET "subdomain" = CASE
  WHEN numbered.dupe_rank = 1 THEN numbered.base_slug
  ELSE numbered.base_slug || '-' || numbered.dupe_rank::text
END
FROM numbered
WHERE numbered."id" = o."id";

-- 3. Now that every row has a value, enforce NOT NULL + uniqueness going forward.
ALTER TABLE "organizations" ALTER COLUMN "subdomain" SET NOT NULL;
CREATE UNIQUE INDEX "organizations_subdomain_key" ON "organizations"("subdomain");
