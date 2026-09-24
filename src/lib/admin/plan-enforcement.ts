import type { OrgPlan, Prisma } from '@prisma/client';
import {
  formatBytes,
  isTrialExpired,
  PLAN_LABELS,
  PLAN_LIMITS,
  startOfCurrentMonth,
} from '@/lib/admin/plan-limits';
import { PlanLimitError, TrialExpiredError } from '@/lib/api-errors';

// Split out of plan-limits.ts because PlanLimitError/TrialExpiredError come from
// api-errors.ts, which imports session.ts -> auth.ts -> db.ts (`import 'server-only'`).
// plan-limits.ts is imported by several 'use client' components for the plain
// constants/labels (PLAN_LABELS, PLAN_ORDER, PLAN_FEATURE_PILLS, buildUsageBars) — those
// have no business pulling in Prisma or the auth stack, but a single import of an
// error class from the same file drags the whole module (and everything it imports) into
// the client bundle, which is exactly what tripped the "You're importing a module that
// depends on 'server-only'" build error. Route handlers (always server-side) import the
// assert*() functions from here instead; plan-limits.ts stays free of anything
// server-only so client components can keep importing the display bits from it directly.
//
// The four plan-limit asserts below and assertOrgActionsAllowed are the actual gate:
// every write path that creates a form, invites a user, stores a file, or accepts a
// public submission calls the matching assert*() before the mutation, inside the same
// withOrgContext(...) transaction the route already opened (RLS requires it — see
// src/lib/db.ts). Each one recomputes usage the same way buildUsageBars()'s admin-billing
// numbers are computed, so "what blocked you" and "what the billing page shows" never
// disagree. `null` limits (Enterprise, plus Professional's maxForms) always pass — there's
// nothing to check.
//
// Messaging is audience-aware: an org's own admin (creating a form, inviting a teammate,
// uploading to the Files library) gets "Upgrade to add more"; a public form respondent
// (submission-limit / storage checks reached from src/app/api/f/[slug]/...) gets neutral
// wording with no upsell, since they can't act on it — see each call site's `audience`.

function pluralize(n: number, noun: string): string {
  return `${n.toLocaleString()} ${noun}${n === 1 ? '' : 's'}`;
}

function orgLimitMessage(plan: OrgPlan, detail: string): string {
  return `Your ${PLAN_LABELS[plan]} plan allows ${detail}. Upgrade to add more.`;
}

function publicLimitMessage(detail: string): string {
  return `This form can't accept ${detail} right now. Please contact the organisation.`;
}

/** Throws PlanLimitError if this org is already at its plan's form cap. Call inside the
 * same withOrgContext transaction used to create the Form, before creating it. */
export async function assertCanCreateForm(
  tx: Prisma.TransactionClient,
  organizationId: string,
  plan: OrgPlan,
): Promise<void> {
  const limit = PLAN_LIMITS[plan].maxForms;
  if (limit === null) return;
  const count = await tx.form.count({ where: { organizationId } });
  if (count >= limit) {
    throw new PlanLimitError(orgLimitMessage(plan, `up to ${pluralize(limit, 'form')}`));
  }
}

/** Throws PlanLimitError if inviting one more user would push this org past its plan's
 * user cap. Counts existing users *and* outstanding (unexpired, unaccepted) invites —
 * otherwise an org could invite far past its cap and only find out once every invite is
 * accepted. Call inside the same withOrgContext transaction used to create the invite. */
export async function assertCanInviteUser(
  tx: Prisma.TransactionClient,
  organizationId: string,
  plan: OrgPlan,
): Promise<void> {
  const limit = PLAN_LIMITS[plan].maxUsers;
  if (limit === null) return;
  const [userCount, pendingInviteCount] = await Promise.all([
    tx.user.count({ where: { organizationId } }),
    tx.userInvite.count({
      where: { organizationId, acceptedAt: null, expiresAt: { gt: new Date() } },
    }),
  ]);
  if (userCount + pendingInviteCount >= limit) {
    throw new PlanLimitError(orgLimitMessage(plan, `up to ${pluralize(limit, 'user')}`));
  }
}

/** Throws PlanLimitError if adding `incomingBytes` would push this org past its plan's
 * storage cap (OrganizationFile + SubmissionFile combined — same two tables
 * buildUsageBars' Storage bar sums). Call before the S3 PUT happens (presign time), not
 * after, so a blocked upload never actually lands in S3. `audience: 'public'` is for the
 * one call site reached by an anonymous form respondent (file_upload/signature/
 * draw_on_image fields on a public form); every other caller is an authenticated org
 * member and gets the upgrade-facing message. */
export async function assertWithinStorageLimit(
  tx: Prisma.TransactionClient,
  organizationId: string,
  plan: OrgPlan,
  incomingBytes: number,
  audience: 'org' | 'public' = 'org',
): Promise<void> {
  const limit = PLAN_LIMITS[plan].maxStorageBytes;
  if (limit === null) return;
  const [orgFiles, submissionFiles] = await Promise.all([
    tx.organizationFile.aggregate({ where: { organizationId }, _sum: { sizeBytes: true } }),
    tx.submissionFile.aggregate({ where: { organizationId }, _sum: { sizeBytes: true } }),
  ]);
  const used = (orgFiles._sum.sizeBytes ?? 0) + (submissionFiles._sum.sizeBytes ?? 0);
  if (used + incomingBytes > limit) {
    throw new PlanLimitError(
      audience === 'public'
        ? publicLimitMessage('this file upload')
        : orgLimitMessage(plan, `${formatBytes(limit)} of storage`),
    );
  }
}

/** Throws PlanLimitError if this org has already reached its plan's submissions-per-month
 * cap (counted the same way as buildUsageBars' "Submissions this month" bar — submitted
 * since startOfCurrentMonth()). Call from the final-submit route
 * (src/app/api/f/[slug]/submissions/[submissionId]/route.ts PATCH), before flipping the
 * submission to 'submitted' — a respondent hits this, so the message stays neutral, not
 * an upgrade pitch aimed at someone who can't act on it. */
export async function assertWithinSubmissionLimit(
  tx: Prisma.TransactionClient,
  organizationId: string,
  plan: OrgPlan,
): Promise<void> {
  const limit = PLAN_LIMITS[plan].maxSubmissionsPerMonth;
  if (limit === null) return;
  const count = await tx.submission.count({
    where: { organizationId, submittedAt: { gte: startOfCurrentMonth() } },
  });
  if (count >= limit) {
    throw new PlanLimitError(publicLimitMessage('new responses this month'));
  }
}

/** Throws TrialExpiredError if this org's trial has lapsed — the gate for "platform
 * actions" (creating/editing forms, inviting users, uploading files, changing org
 * settings). Deliberately not applied to every mutating route: personal account actions
 * (password/2FA) and reading data are always allowed, and a submission already in
 * progress is allowed to finish (see the public-lookup.ts comment on the same principle
 * for forms taken offline manually). Call inside the same withOrgContext transaction the
 * route already opened. */
export async function assertOrgActionsAllowed(
  tx: Prisma.TransactionClient,
  organizationId: string,
): Promise<void> {
  const organization = await tx.organization.findUnique({
    where: { id: organizationId },
    select: { status: true, trialEndsAt: true },
  });
  if (organization && isTrialExpired(organization)) {
    throw new TrialExpiredError(
      'Your trial has ended. Subscribe to keep making changes — see /pricing or contact us.',
    );
  }
}
