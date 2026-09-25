-- Splits FormTemplate's single free-text `category` into three independent browsing
-- facets (industry, category, form_type) for the redesigned /forms/templates gallery
-- sidebar. `category` itself keeps its name and any existing data — this only adds the
-- two new columns alongside it. See the FormTemplate doc comment in prisma/schema.prisma
-- for the full design note.

ALTER TABLE "form_templates" ADD COLUMN "industry" TEXT;
ALTER TABLE "form_templates" ADD COLUMN "form_type" TEXT;
