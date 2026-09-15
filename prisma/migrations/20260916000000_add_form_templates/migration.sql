-- CreateEnum
CREATE TYPE "template_status" AS ENUM ('draft', 'published', 'archived');

-- Reusable form definitions authored by Clickforms staff in /admin/templates and
-- offered to every organisation via the /forms/templates gallery. See
-- prisma/schema.prisma FormTemplate doc comment for the full design note.

CREATE TABLE "form_templates" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "status" "template_status" NOT NULL DEFAULT 'draft',
    "schema" JSONB NOT NULL,
    "thumbnail_storage_key" TEXT,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "form_templates_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "form_templates_status_idx" ON "form_templates"("status");

ALTER TABLE "form_templates" ADD CONSTRAINT "form_templates_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- No Row-Level Security here, same reasoning as email_log/platform_admin_org_access:
-- this table is org-less and only ever read/written via the plain `prisma` client from
-- platform-admin-only routes (writes) or any authenticated org user (published-only
-- reads), never inside a withOrgContext transaction scoped to a single tenant.
