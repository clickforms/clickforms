import type { OrgPlan, OrgStatus } from '@prisma/client';

// Deliberately no imports from api-errors.ts (or anything else server-only) here — this
// file is imported directly by several 'use client' components for the plain display
// constants (PLAN_LABELS, PLAN_ORDER, PLAN_FEATURE_PILLS, buildUsageBars). The
// Prisma-transaction assert*() functions that enforce these limits (and need
// PlanLimitError/TrialExpiredError, which chain into session.ts -> auth.ts -> db.ts's
// `import 'server-only'`) live in src/lib/admin/plan-enforcement.ts instead — importing
// them from here would drag that whole server-only chain into the client bundle.

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

/** The qualitative perks in PlanLimits that don't reduce to a usage bar — shared between
 * the platform-admin /admin/billing org cards and the org-facing Organisation settings
 * page (src/app/forms/organisation) so the two "which perks does this plan include"
 * displays can't drift apart. Order matches the /pricing page's feature list. */
export const PLAN_FEATURE_PILLS: {
  key: 'removeBranding' | 'apiAccess' | 'customDomain';
  label: string;
}[] = [
  { key: 'removeBranding', label: 'No Clickforms branding' },
  { key: 'apiAccess', label: 'API access' },
  { key: 'customDomain', label: 'Custom domain' },
];

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

// --- Trial status ------------------------------------------------------------------------
//
// Self-service signups start `status: 'trial'` with `trialEndsAt` 7 days out (see
// src/app/api/auth/signup/verify/route.ts); a platform admin can also put any existing org
// on a trial with a custom plan and end date from /admin/organisations/[id] (see
// organisation-detail-admin-client.tsx). Sign-in is never blocked by an expired trial (see
// src/lib/auth.ts) — the org just loses write access and its public forms stop accepting
// new responses until a platform admin assigns a real plan (or extends the trial).

/** True once `trialEndsAt` has passed for an org whose status is still 'trial' — an org
 * that was never on a trial, or was moved off one (see the billing-admin-client
 * handlePlanChange comment), always returns false regardless of what trialEndsAt still
 * holds from a past trial. */
export function isTrialExpired(org: { status: OrgStatus; trialEndsAt: Date | null }): boolean {
  return org.status === 'trial' && org.trialEndsAt !== null && org.trialEndsAt < new Date();
}

// The Prisma-transaction assert*() enforcement functions (assertCanCreateForm,
// assertCanInviteUser, assertWithinStorageLimit, assertWithinSubmissionLimit,
// assertOrgActionsAllowed) live in src/lib/admin/plan-enforcement.ts, not here — see the
// comment at the top of this file for why.
