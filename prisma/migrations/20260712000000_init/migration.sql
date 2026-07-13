-- Clickforms — initial schema migration.
--
-- HAND-WRITTEN, NOT machine-generated: this sandbox has no reachable Postgres instance
-- and Prisma's CLI cannot fetch its schema-engine binary here (network allowlist blocks
-- binaries.prisma.sh), so `prisma migrate dev` could not be run to generate this file the
-- normal way. It was authored to match prisma/schema.prisma exactly, in the same format
-- and naming conventions `prisma migrate dev` produces (table/column snake_case via
-- @@map/@map, `<table>_<column>_fkey` / `<table>_<cols>_key` / `<table>_<cols>_idx`
-- naming). BEFORE FIRST REAL USE: run `yarn prisma:migrate` (prisma migrate dev) against
-- a real Postgres 16 instance (e.g. `docker-compose.dev.yml`) and diff the engine's own
-- output against this file to confirm they match; then let Prisma take over migration
-- authorship from there.
--
-- PostgreSQL 13+ ships `gen_random_uuid()` in core — no `pgcrypto`/`uuid-ossp` extension
-- required.

-- CreateEnum
CREATE TYPE "user_role" AS ENUM ('admin', 'editor', 'viewer');

-- CreateEnum
CREATE TYPE "form_status" AS ENUM ('draft', 'published', 'archived');

-- CreateEnum
CREATE TYPE "submission_status" AS ENUM ('in_progress', 'submitted', 'approved', 'rejected');

-- CreateEnum
CREATE TYPE "workflow_step_status" AS ENUM ('pending', 'approved', 'rejected');

-- CreateTable
CREATE TABLE "organizations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "user_role" NOT NULL DEFAULT 'viewer',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "forms" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" "form_status" NOT NULL DEFAULT 'draft',
    "current_version_id" UUID,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "forms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "form_versions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "form_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "schema" JSONB NOT NULL,
    "version_number" INTEGER NOT NULL,
    "published_at" TIMESTAMP(3),

    CONSTRAINT "form_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "submissions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "form_id" UUID NOT NULL,
    "form_version_id" UUID NOT NULL,
    "status" "submission_status" NOT NULL DEFAULT 'in_progress',
    "answers" JSONB NOT NULL DEFAULT '{}',
    "resume_token" TEXT,
    "ip_address" TEXT,
    "submitted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "submission_files" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "submission_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "field_key" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "submission_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "signatures" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "submission_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "field_key" TEXT NOT NULL,
    "signature_image_key" TEXT NOT NULL,
    "signer_name" TEXT NOT NULL,
    "consent_text_version" TEXT NOT NULL,
    "ip_address" TEXT NOT NULL,
    "user_agent" TEXT NOT NULL,
    "signed_at" TIMESTAMP(3) NOT NULL,
    "content_hash" TEXT NOT NULL,

    CONSTRAINT "signatures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_steps" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "submission_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "step_order" INTEGER NOT NULL,
    "approver_user_id" UUID NOT NULL,
    "status" "workflow_step_status" NOT NULL DEFAULT 'pending',
    "acted_at" TIMESTAMP(3),
    "comments" TEXT,

    CONSTRAINT "workflow_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "actor_user_id" UUID,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" UUID NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "forms_current_version_id_key" ON "forms"("current_version_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_organization_id_email_key" ON "users"("organization_id", "email");

-- CreateIndex
CREATE INDEX "users_organization_id_idx" ON "users"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "forms_organization_id_slug_key" ON "forms"("organization_id", "slug");

-- CreateIndex
CREATE INDEX "forms_organization_id_idx" ON "forms"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "form_versions_form_id_version_number_key" ON "form_versions"("form_id", "version_number");

-- CreateIndex
CREATE INDEX "form_versions_organization_id_idx" ON "form_versions"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "submissions_resume_token_key" ON "submissions"("resume_token");

-- CreateIndex
CREATE INDEX "submissions_organization_id_idx" ON "submissions"("organization_id");

-- CreateIndex
CREATE INDEX "submissions_form_id_status_idx" ON "submissions"("form_id", "status");

-- CreateIndex
CREATE INDEX "submission_files_organization_id_idx" ON "submission_files"("organization_id");

-- CreateIndex
CREATE INDEX "submission_files_submission_id_idx" ON "submission_files"("submission_id");

-- CreateIndex
CREATE INDEX "signatures_organization_id_idx" ON "signatures"("organization_id");

-- CreateIndex
CREATE INDEX "signatures_submission_id_idx" ON "signatures"("submission_id");

-- CreateIndex
CREATE INDEX "workflow_steps_organization_id_idx" ON "workflow_steps"("organization_id");

-- CreateIndex
CREATE INDEX "workflow_steps_submission_id_idx" ON "workflow_steps"("submission_id");

-- CreateIndex
CREATE INDEX "audit_log_organization_id_idx" ON "audit_log"("organization_id");

-- CreateIndex
CREATE INDEX "audit_log_entity_type_entity_id_idx" ON "audit_log"("entity_type", "entity_id");

-- AddForeignKey
-- All foreign keys are added after every table exists, which is what breaks the
-- forms <-> form_versions circular reference (forms.current_version_id points at a
-- form_versions row; form_versions.form_id points back at forms).
ALTER TABLE "users" ADD CONSTRAINT "users_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forms" ADD CONSTRAINT "forms_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forms" ADD CONSTRAINT "forms_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forms" ADD CONSTRAINT "forms_current_version_id_fkey" FOREIGN KEY ("current_version_id") REFERENCES "form_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_versions" ADD CONSTRAINT "form_versions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_versions" ADD CONSTRAINT "form_versions_form_id_fkey" FOREIGN KEY ("form_id") REFERENCES "forms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_form_id_fkey" FOREIGN KEY ("form_id") REFERENCES "forms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_form_version_id_fkey" FOREIGN KEY ("form_version_id") REFERENCES "form_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submission_files" ADD CONSTRAINT "submission_files_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submission_files" ADD CONSTRAINT "submission_files_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signatures" ADD CONSTRAINT "signatures_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signatures" ADD CONSTRAINT "signatures_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_steps" ADD CONSTRAINT "workflow_steps_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_steps" ADD CONSTRAINT "workflow_steps_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_steps" ADD CONSTRAINT "workflow_steps_approver_user_id_fkey" FOREIGN KEY ("approver_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
