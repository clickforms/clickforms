import { NextResponse } from 'next/server';
import { z } from 'zod';
import { toErrorResponse } from '@/lib/api-errors';
import { logAudit } from '@/lib/audit';
import { prisma } from '@/lib/db';
import { sendEmail } from '@/lib/email';
import { inviteEmail } from '@/lib/emails/templates';
import { uniqueSlug } from '@/lib/forms/slug';
import { requirePlatformAdmin, requireSession } from '@/lib/session';
import { inviteAcceptUrl } from '@/lib/users/invite-url';

// Same lenient ABN check as src/app/api/admin/organizations/[id]/route.ts and
// src/app/api/organization/route.ts.
const ABN_PATTERN = /^\d{11}$/;

const createOrganizationBodySchema = z.object({
  organizationName: z.string().trim().min(1, 'Organisation name is required').max(200),
  adminName: z.string().trim().min(1, "Admin's name is required").max(200),
  adminEmail: z.string().trim().email('Enter a valid email'),
  abn: z
    .string()
    .trim()
    .transform((value) => value.replace(/\s+/g, ''))
    .refine((value) => value === '' || ABN_PATTERN.test(value), {
      message: 'ABN must be 11 digits',
    })
    .optional(),
  // Defaults to standard — matches Organization.plan's own schema default — so onboarding
  // an org without picking a plan behaves exactly as it did before this field existed.
  plan: z.enum(['standard', 'business', 'professional', 'enterprise']).default('standard'),
});

const ORGANIZATION_LIST_SELECT = {
  id: true,
  name: true,
  subdomain: true,
  plan: true,
  status: true,
  createdAt: true,
} as const;

/**
 * Lists every organisation in the system. Deliberately runs against the plain `prisma`
 * client rather than `withOrgContext` — a platform admin's whole point is to see across
 * organisations, and RLS's `tenant_isolation` policy can only ever scope to one
 * `app.current_org_id` at a time. Same "no single org to scope by" exception as the
 * token lookups in src/lib/auth.ts and the invite-accept route.
 */
export async function GET(): Promise<NextResponse> {
  try {
    const session = await requireSession();
    requirePlatformAdmin(session);

    const organizations = await prisma.organization.findMany({
      orderBy: { createdAt: 'desc' },
      select: ORGANIZATION_LIST_SELECT,
    });

    const [userCounts, formCounts] = await Promise.all([
      prisma.user.groupBy({ by: ['organizationId'], _count: { _all: true } }),
      prisma.form.groupBy({ by: ['organizationId'], _count: { _all: true } }),
    ]);
    const userCountByOrg = new Map(userCounts.map((row) => [row.organizationId, row._count._all]));
    const formCountByOrg = new Map(formCounts.map((row) => [row.organizationId, row._count._all]));

    return NextResponse.json({
      organizations: organizations.map((org) => ({
        id: org.id,
        name: org.name,
        subdomain: org.subdomain,
        plan: org.plan,
        status: org.status,
        createdAt: org.createdAt.toISOString(),
        userCount: userCountByOrg.get(org.id) ?? 0,
        formCount: formCountByOrg.get(org.id) ?? 0,
      })),
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}

/**
 * Onboards a brand-new organisation: creates the Organization row, then a pending
 * UserInvite for its founding admin (they set their own password via the same
 * /signup/accept flow as any other invited user — see src/app/api/invites/accept/route.ts).
 * Mirrors POST /api/auth/signup/verify's org-creation transaction, but admin-initiated
 * and invite-based rather than self-service.
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const session = await requireSession();
    requirePlatformAdmin(session);

    const body = createOrganizationBodySchema.parse(await request.json());
    const adminEmail = body.adminEmail.toLowerCase();

    const existingOrganizations = await prisma.organization.findMany({
      select: { subdomain: true },
    });
    const subdomain = uniqueSlug(
      body.organizationName,
      new Set(existingOrganizations.map((org) => org.subdomain)),
    );

    const result = await prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: {
          name: body.organizationName,
          subdomain,
          abn: body.abn ? body.abn : null,
          plan: body.plan,
        },
      });

      const token = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      const invite = await tx.userInvite.create({
        data: {
          organizationId: organization.id,
          email: adminEmail,
          name: body.adminName,
          role: 'admin',
          token,
          invitedById: session.user.id,
          expiresAt,
        },
      });

      await logAudit(
        {
          organizationId: organization.id,
          actorUserId: session.user.id,
          action: 'admin.organization_create',
          entityType: 'organization',
          entityId: organization.id,
          metadata: { name: organization.name, adminEmail, plan: body.plan },
        },
        tx,
      );

      return { organization, invite };
    });

    const inviteUrl = inviteAcceptUrl(result.invite.token);
    const rendered = inviteEmail({
      name: body.adminName,
      organizationName: result.organization.name,
      role: 'admin',
      invitedByName: 'The Clickforms team',
      inviteUrl,
    });

    await sendEmail({
      to: adminEmail,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      kind: 'invite',
      organizationId: result.organization.id,
    });

    return NextResponse.json(
      {
        organizationId: result.organization.id,
        inviteUrl,
        expiresAt: result.invite.expiresAt.toISOString(),
      },
      { status: 201 },
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}
