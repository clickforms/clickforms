-- Brings the database in line with prisma/schema.prisma for form_prefills.parent_id.
-- The original migration (20261003000000_prefill_corrections) added the foreign key inline
-- without ON UPDATE CASCADE, which Prisma's relation defaults to. The matching index
-- (form_prefills_parent_id_idx) already exists and is now declared in the schema.
ALTER TABLE "form_prefills" DROP CONSTRAINT "form_prefills_parent_id_fkey";
ALTER TABLE "form_prefills"
  ADD CONSTRAINT "form_prefills_parent_id_fkey"
  FOREIGN KEY ("parent_id") REFERENCES "form_prefills"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
