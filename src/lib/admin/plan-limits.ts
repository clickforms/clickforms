import type { OrgPlan, Prisma } from '@prisma/client';
import { PlanLimitError } from '@/lib/api-errors';

/**
 * Hardcoded plan tiers for the /admin billing page and the public /pricing page (see
 * src/components/landing/landing-pricing.tsx — keep the two in sync by hand, there's no
 * shared source of truth yet). No payment provider is wired up — these are the caps
 * platform admins reference when deciding whether an org needs to be upgraded, not an
 * enforced quota (nothing currently blocks a form/user/submission from being created past
 * its plan's limit — see the pending enforcement work).
 * `null` means unlimited.
 */
export interface PlanLimits {
  maxForms: number | null;
  maxUsers: number | null;
  maxStorageBytes: number | null;
  /** Submissions counted per calendar month, not cumulative like the other three. */
  maxSubmissionsPerMonth: number | null;
  /** Qualitative perks that don't reduce to a number — checked directly by feature-gated
   * UI/routes (e.g. "hide the Clickforms footer on public forms") rather than through
   * buildUsageBars(), which only covers the four numeric caps above. */
  removeBranding: boolean;
  apiAccess: boolean;
  customDomain: boolean;
}

export const PLAN_LIMITS: Record<OrgPlan, PlanLimits> = {
  standard: {
    maxForms: 10,
    maxUsers: 1,
    maxStorageBytes: 500 * 1024 * 1024,
    maxSubmissionsPerMonth: 1000,
    removeBranding: false,
    apiAccess: false,
    customDomain: false,
  },
  business: {
    maxForms: 50,
    maxUsers: 15,
    maxStorageBytes: 10 * 1024 * 1024 * 1024,
    maxSubmissionsPerMonth: 10000,
    removeBranding: true,
    apiAccess: true,
    customDomain: false,
  },
  professional: {
    maxForms: null,
    maxUsers: 50,
    maxStorageBytes: 50 * 1024 * 1024 * 1024,
    maxSubmissionsPerMonth: 30000,
    removeBranding: true,
    apiAccess: true,
    customDomain: true,
  },
  enterprise: {
    maxForms: null,
    maxUsers: null,
    maxStorageBytes: null,
    maxSubmissionsPerMonth: null,
    removeBranding: true,
    apiAccess: true,
    customDomain: true,
  },
};

export const PLAN_LABELS: Record<OrgPlan, string> = {
  standard: 'Standard',
  business: 'Business',
  professional: 'Professional',
  enterprise: 'Enterprise',
};

export const PLAN_ORDER = [
  'standard',
  'business',
  'professional',
  'enterprise',
] as const satisfies readonly OrgPlan[];

export interface PlanUsage {
  forms: number;
  users: number;
  storageBytes: number;
  /** Count of submissions created since the start of the current calendar month. */
  submissionsThisMonth: number;
}

export interface PlanUsageBar {
  label: string;
  used: number;
  limit: number | null;
  /** 0-100, or null when the plan has no cap for this resource. */
  percent: number | null;
  formatted: string;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unitIndex]}`;
}

function usageBar(
  label: string,
  used: number,
  limit: number | null,
  formatUsed: (n: number) => string,
): PlanUsageBar {
  return {
    label,
    used,
    limit,
    percent: limit ? Math.min(100, Math.round((used / limit) * 100)) : null,
    formatted: limit
      ? `${formatUsed(used)} of ${formatUsed(limit)}`
      : `${formatUsed(used)} · Unlimited`,
  };
}

/** Builds the four usage bars shown on an org's row in /admin/billing. */
export function buildUsageBars(plan: OrgPlan, usage: PlanUsage): PlanUsageBar[] {
  const limits = PLAN_LIMITS[plan];
  return [
    usageBar('Forms', usage.forms, limits.maxForms, (n) => String(n)),
    usageBar('Users', usage.users, limits.maxUsers, (n) => String(n)),
    usageBar('Storage', usage.storageBytes, limits.maxStorageBytes, formatBytes),
    usageBar(
      'Submissions this month',
      usage.submissionsThisMonth,
      limits.maxSubmissionsPerMonth,
      (n) => n.toLocaleString(),
    ),
  ];
}

/** Start of the current calendar month in UTC — the window buildUsageBars' submissions
 * bar and the pending per-request enforcement both count against. Not stored anywhere;
 * recomputed from `new Date()` on every call, same as every other usage number here. */
export function startOfCurrentMonth(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

// --- Enforcement -----------------------------------------------------------------------
//
// The four functions below are the actual gate: every write path that creates a form,
// invites a user, stores a file, or accepts a public submission calls the matching
// assert*() before the mutation, inside the same withOrgContext(...) transaction the
// route already opened (RLS requires it — see src/lib/db.ts). Each one recomputes usage
// the same way buildUsageBars()'s admin-billing numbers are computed, so "what blocked
// you" and "what the billing page shows" never disagree. `null` limits (Enterprise, plus
// Professional's maxForms) always pass — there's nothing to check.
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
