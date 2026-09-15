import type { OrgPlan } from '@prisma/client';

/**
 * Hardcoded plan tiers for the /admin billing page (specs follow-up: platform admin
 * console). No payment provider is wired up — these are the caps platform admins
 * reference when deciding whether an org needs to be upgraded, not an enforced quota
 * (nothing currently blocks a form/user from being created past its plan's limit).
 * `null` means unlimited.
 */
export interface PlanLimits {
  maxForms: number | null;
  maxUsers: number | null;
  maxStorageBytes: number | null;
}

export const PLAN_LIMITS: Record<OrgPlan, PlanLimits> = {
  free: { maxForms: 10, maxUsers: 5, maxStorageBytes: 500 * 1024 * 1024 },
  pro: { maxForms: 50, maxUsers: 15, maxStorageBytes: 10 * 1024 * 1024 * 1024 },
  enterprise: { maxForms: null, maxUsers: null, maxStorageBytes: 100 * 1024 * 1024 * 1024 },
};

export const PLAN_LABELS: Record<OrgPlan, string> = {
  free: 'Free',
  pro: 'Pro',
  enterprise: 'Enterprise',
};

export const PLAN_ORDER = ['free', 'pro', 'enterprise'] as const satisfies readonly OrgPlan[];

export interface PlanUsage {
  forms: number;
  users: number;
  storageBytes: number;
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

/** Builds the three usage bars shown on an org's row in /admin/billing. */
export function buildUsageBars(plan: OrgPlan, usage: PlanUsage): PlanUsageBar[] {
  const limits = PLAN_LIMITS[plan];
  return [
    usageBar('Forms', usage.forms, limits.maxForms, (n) => String(n)),
    usageBar('Users', usage.users, limits.maxUsers, (n) => String(n)),
    usageBar('Storage', usage.storageBytes, limits.maxStorageBytes, formatBytes),
  ];
}
