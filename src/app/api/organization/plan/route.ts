import { NextResponse } from 'next/server';
import { z } from 'zod';
import { InvalidRequestError, toErrorResponse } from '@/lib/api-errors';
import { logAudit } from '@/lib/audit';
import { withOrgContext } from '@/lib/db';
import { requireOrganizationId, requireRole, requireSession } from '@/lib/session';

const patchPlanBodySchema = z.object({
  plan: z.enum(['standard', 'business', 'professional', 'enterprise']),
});

/**
 * Self-service plan change — an org admin picking a different tier directly from
 * Organisation settings' Billing tab, no payment step involved (see PLAN_LIMITS' doc
 * comment in plan-limits.ts: nothing charges anyone yet, this just moves the enum value).
 *
 * Deliberately NOT gated by assertOrgActionsAllowed, unlike every sibling route in
 * src/app/api/organization/* — this route is the way *out* of a trial-expired block
 * (picking a real plan is what "subscribe to keep making changes" means), so it has to
 * stay reachable even once that gate would otherwise fire on this org. It's also simply
 * unreachable for a suspended org regardless: auth.ts blocks sign-in entirely once status
 * is 'suspended', so no session can exist to call this route with — self-service can't
 * undo a platform admin's suspension, only a trial's expiry.
 *
 * Downgrading below current usage (e.g. 3 users onto a 1-user plan) is allowed, same as a
 * platform admin doing it from /admin/billing — existing forms/users/files aren't touched,
 * only the plan's write-path asserts (assertCanCreateForm etc.) start blocking the next
 * attempt to add more. The client warns about this before submitting; it isn't re-checked
 * here since it's advisory, not a rule.
 */
export async function PATCH(request: Request): Promise<NextResponse> {
  try {
    const session = await requireSession();
    requireRole(session, ['admin']);
    const body = patchPlanBodySchema.parse(await request.json());

    const organization = await withOrgContext(session.user.organizationId, async (tx) => {
      const existing = await tx.organization.findFirstOrThrow({
        where: { id: requireOrganizationId(session) },
        select: { id: true, plan: true, status: true },
      });

      if (body.plan === existing.plan && existing.status !== 'trial') {
        throw new InvalidRequestError('This organisation is already on that plan.');
      }

      const updated = await tx.organization.update({
        where: { id: existing.id },
        data: {
          plan: body.plan,
          // Picking a plan is how a trialing org graduates, expired or not — same "flip
          // status back to active" the platform-admin billing page does (see
          // billing-admin-client.tsx's handlePlanChange) so isTrialExpired() stops firing
          // on the very next request rather than lingering until some other save.
          ...(existing.status === 'trial' ? { status: 'active' as const } : {}),
        },
        select: {
          plan: true,
          status: true,
          trialEndsAt: true,
          renewsAt: true,
        },
      });

      await logAudit(
        {
          organizationId: existing.id,
          actorUserId: session.user.id,
          action: 'organization.plan_change',
          entityType: 'organization',
          entityId: existing.id,
          metadata: { fromPlan: existing.plan, toPlan: body.plan, fromStatus: existing.status },
        },
        tx,
      );

      return updated;
    });

    return NextResponse.json({
      plan: {
        ...organization,
        trialEndsAt: organization.trialEndsAt?.toISOString() ?? null,
        renewsAt: organization.renewsAt?.toISOString() ?? null,
      },
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
