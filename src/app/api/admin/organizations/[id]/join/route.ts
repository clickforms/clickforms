import { NextResponse } from 'next/server';
import { InvalidRequestError, NotFoundError, toErrorResponse } from '@/lib/api-errors';
import { logAudit } from '@/lib/audit';
import { withOrgContext } from '@/lib/db';
import { requirePlatformAdmin, requireSession } from '@/lib/session';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * Lets a Clickforms platform admin temporarily attach themselves to a customer
 * organisation — for testing, bug fixes, or investigation — without going through the
 * normal email-invite flow. Always joins as `role: admin`; see prisma/schema.prisma
 * PlatformAdminOrgAccess for the audit trail this also writes, and
 * src/app/api/me/leave-organization/route.ts for the reverse.
 *
 * Uses `session.user.organizationId` (from the trusted JWT) rather than a fresh DB read
 * to check the actor's current org — a plain `prisma.user.findUnique` for a platform
 * admin who is CURRENTLY joined to a (different) organisation would be hidden by that
 * org's RLS tenant_isolation policy (neither policy on `users` matches without the
 * right app.current_org_id set), so the session is the only reliable source here.
 */
export async function POST(_request: Request, { params }: RouteContext): Promise<NextResponse> {
  try {
    const session = await requireSession();
    requirePlatformAdmin(session);
    const { id } = await params;

    if (session.user.organizationId === id) {
      throw new InvalidRequestError('You are already a member of this organisation.');
    }
    if (session.user.organizationId) {
      throw new InvalidRequestError('Leave your current organisation before joining another one.');
    }

    const organizationName = await withOrgContext(id, async (tx) => {
      const organization = await tx.organization.findUnique({
        where: { id },
        select: { name: true },
      });
      if (!organization) throw new NotFoundError('Organization');

      // users_organization_id_email_key (@@unique([organizationId, email])) would
      // otherwise reject this update with a raw P2002 — checked up front so a platform
      // admin whose email happens to collide with an existing member of this org (e.g.
      // they were separately invited here under the same address) gets a clear reason
      // instead of a 500.
      const emailCollision = await tx.user.findUnique({
        where: { organizationId_email: { organizationId: id, email: session.user.email ?? '' } },
        select: { id: true },
      });
      if (emailCollision) {
        throw new InvalidRequestError(
          'This organisation already has a member with your email address — join is not possible.',
        );
      }

      await tx.user.update({
        where: { id: session.user.id },
        data: { organizationId: id, role: 'admin' },
      });

      await tx.platformAdminOrgAccess.create({
        data: { userId: session.user.id, organizationId: id },
      });

      await logAudit(
        {
          organizationId: id,
          actorUserId: session.user.id,
          action: 'platform_admin.joined_organization',
          entityType: 'organization',
          entityId: id,
          metadata: { email: session.user.email },
        },
        tx,
      );

      return organization.name;
    });

    return NextResponse.json({ ok: true, organizationId: id, organizationName });
  } catch (error) {
    return toErrorResponse(error);
  }
}
