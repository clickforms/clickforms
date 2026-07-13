-- CreateTable
CREATE TABLE "organization_files" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "uploaded_by_id" UUID,
    "storage_key" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organization_files_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "organization_files_organization_id_idx" ON "organization_files"("organization_id");

-- AddForeignKey
ALTER TABLE "organization_files" ADD CONSTRAINT "organization_files_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_files" ADD CONSTRAINT "organization_files_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Row-Level Security (same tenant_isolation pattern as submission_files)
ALTER TABLE "organization_files" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "organization_files" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "organization_files"
  USING ("organization_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid)
  WITH CHECK ("organization_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
