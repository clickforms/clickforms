-- Audit trail for a Clickforms platform admin temporarily joining a customer
-- Organization (setting their own User.organizationId + role: admin) to do testing,
-- bug fixes, or investigation, then leaving again. One row per join; leftAt IS NULL
-- means the admin is still attached. See prisma/schema.prisma PlatformAdminOrgAccess
-- doc comment and src/app/api/admin/organizations/[id]/join, src/app/api/me/leave-organization.

CREATE TABLE "platform_admin_org_access" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "left_at" TIMESTAMP(3),

    CONSTRAINT "platform_admin_org_access_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "platform_admin_org_access_user_id_idx" ON "platform_admin_org_access"("user_id");
CREATE INDEX "platform_admin_org_access_organization_id_idx" ON "platform_admin_org_access"("organization_id");

ALTER TABLE "platform_admin_org_access" ADD CONSTRAINT "platform_admin_org_access_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "platform_admin_org_access" ADD CONSTRAINT "platform_admin_org_access_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- No Row-Level Security here, same reasoning as email_log: this table is only ever
-- read/written via the plain `prisma` client from platform-admin-only routes (and the
-- NextAuth jwt callback), which are inherently cross-organization and never run inside
-- a withOrgContext transaction scoped to a single tenant.
