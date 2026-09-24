import { NextResponse } from 'next/server';
import { z } from 'zod';
import { NotFoundError, toErrorResponse } from '@/lib/api-errors';
import { logAudit } from '@/lib/audit';
import { prisma, withOrgContext } from '@/lib/db';
import { requirePlatformAdmin, requireSession } from '@/lib/session';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// Same lenient ABN check as src/app/api/organization/route.ts.
const ABN_PATTERN = /^\d{11}$/;

const patchOrganizationBodySchema = z.object({
  name: z.string().trim().min(1, 'Organisation name is required').max(200).optional(),
  abn: z
    .string()
    .trim()
    .transform((value) => value.replace(/\s+/g, ''))
    .refine((value) => value === '' || ABN_PATTERN.test(value), {
      message: 'ABN must be 11 digits',
    })
    .optional(),
  contactName: z.string().trim().max(200).optional(),
  contactEmail: z
    .string()
    .trim()
    .max(255)
    .email('Invalid email address')
    .optional()
    .or(z.literal('')),
  contactPhone: z.string().trim().max(30).optional(),
  // Billing/lifecycle fields — set from the Organisations list (kebab menu Suspend/
  // Reactivate) and the Billing & plan limits page (Change plan). Kept on this same
  // PATCH endpoint rather than a new route since they're just more organization columns.
  plan: z.enum(['standard', 'business', 'professional', 'enterprise']).optional(),
  status: z.enum(['active', 'trial', 'suspended']).optional(),
  trialEndsAt: z.string().datetime().nullable().optional(),
  renewsAt: z.string().datetime().nullable().optional(),
});

const ORG_DETAIL_SELECT = {
  id: true,
  name: true,
  subdomain: true,
  abn: true,
  contactName: true,
  contactEmail: true,
  contactPhone: true,
  plan: true,
  status: true,
  trialEndsAt: true,
  renewsAt: true,
  createdAt: true,
} as const;

/** Full detail for one organisation, plus its users and pending invites. Platform admin only. */
export async function GET(_request: Request, { params }: RouteContext): Promise<NextResponse> {
  try {
    const session = await requireSession();
    requirePlatformAdmin(session);
    const { id } = await params;

    const result = await withOrgContext(id, async (tx) => {
      const organization = await tx.organization.findUnique({
        where: { id },
        select: ORG_DETAIL_SELECT,
      });
      if (!organization) throw new NotFoundError('Organization');

      const [users, pendingInvites] = await Promise.all([
        tx.user.findMany({
          where: { organizationId: id },
          orderBy: { createdAt: 'asc' },
          select: { id: true, name: true, email: true, role: true, createdAt: true },
        }),
        tx.userInvite.findMany({
          where: { organizationId: id, acceptedAt: null, expiresAt: { gt: new Date() } },
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            expiresAt: true,
            createdAt: true,
          },
        }),
      ]);

      return { organization, users, pendingInvites };
    });

    return NextResponse.json({
      organization: {
        ...result.organization,
        createdAt: result.organization.createdAt.toISOString(),
        trialEndsAt: result.organization.trialEndsAt?.toISOString() ?? null,
        renewsAt: result.organization.renewsAt?.toISOString() ?? null,
      },
      users: result.users.map((user) => ({ ...user, createdAt: user.createdAt.toISOString() })),
      pendingInvites: result.pendingInvites.map((invite) => ({
        ...invite,
        createdAt: invite.createdAt.toISOString(),
        expiresAt: invite.expiresAt.toISOString(),
      })),
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}

/** Updates an organisation's profile fields. Platform admin only — any organisation. */
export async function PATCH(request: Request, { params }: RouteContext): Promise<NextResponse> {
  try {
    const session = await requireSession();
    requirePlatformAdmin(session);
    const { id } = await params;
    const body = patchOrganizationBodySchema.parse(await request.json());

    const organization = await withOrgContext(id, async (tx) => {
      const existing = await tx.organization.findUnique({ where: { id } });
      if (!existing) throw new NotFoundError('Organization');

      const updated = await tx.organization.update({
        where: { id },
        data: {
          ...(body.name !== undefined ? { name: body.name } : {}),
          ...(body.abn !== undefined ? { abn: body.abn === '' ? null : body.abn } : {}),
          ...(body.contactName !== undefined
            ? { contactName: body.contactName === '' ? null : body.contactName }
            : {}),
          ...(body.contactEmail !== undefined
            ? { contactEmail: body.contactEmail === '' ? null : body.contactEmail }
            : {}),
          ...(body.contactPhone !== undefined
            ? { contactPhone: body.contactPhone === '' ? null : body.contactPhone }
            : {}),
          ...(body.plan !== undefined ? { plan: body.plan } : {}),
          ...(body.status !== undefined ? { status: body.status } : {}),
          ...(body.trialEndsAt !== undefined
            ? { trialEndsAt: body.trialEndsAt ? new Date(body.trialEndsAt) : null }
            : {}),
          ...(body.renewsAt !== undefined
            ? { renewsAt: body.renewsAt ? new Date(body.renewsAt) : null }
            : {}),
        },
        select: ORG_DETAIL_SELECT,
      });

      await logAudit(
        {
          organizationId: id,
          actorUserId: session.user.id,
          action: 'admin.organization_update',
          entityType: 'organization',
          entityId: id,
          metadata: { ...body },
        },
        tx,
      );

      return updated;
    });

    return NextResponse.json({
      organization: {
        ...organization,
        createdAt: organization.createdAt.toISOString(),
        trialEndsAt: organization.trialEndsAt?.toISOString() ?? null,
        renewsAt: organization.renewsAt?.toISOString() ?? null,
      },
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}

/**
 * Permanently deletes an organisation and everything under it (users, forms, submissions,
 * files, etc. — every tenant-scoped table cascades from `organizations.id`, see
 * prisma/schema.prisma `onDelete: Cascade`). No undo; the client confirms this before
 * calling. Audit-logged on the `prisma` client directly since the org row (and therefore
 * the org this log entry would otherwise be scoped to) no longer exists once deleted.
 */
export async function DELETE(_request: Request, { params }: RouteContext): Promise<NextResponse> {
  try {
    const session = await requireSession();
    requirePlatformAdmin(session);
    const { id } = await params;

    const existing = await prisma.organization.findUnique({
      where: { id },
      select: { id: true, name: true },
    });
    if (!existing) throw new NotFoundError('Organization');

    await prisma.organization.delete({ where: { id } });

    console.info(
      `[admin] organization deleted: ${existing.name} (${existing.id}) by ${session.user.email}`,
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    return toErrorResponse(error);
  }
}
