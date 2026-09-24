'use client';

import type { OrgPlan, OrgStatus } from '@prisma/client';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useToast } from '@/components/toast';
import { buildUsageBars, PLAN_LABELS, PLAN_LIMITS, PLAN_ORDER } from '@/lib/admin/plan-limits';
import { readApiError } from '@/lib/error-message';

export interface BillingOrgRow {
  id: string;
  name: string;
  subdomain: string;
  plan: OrgPlan;
  status: OrgStatus;
  trialEndsAt: string | null;
  renewsAt: string | null;
  usage: {
    forms: number;
    users: number;
    storageBytes: number;
    submissionsThisMonth: number;
  };
}

const STATUS_BADGE_CLASS: Record<OrgStatus, string> = {
  active: 'badge--success',
  trial: 'badge--draft',
  suspended: 'badge--error',
};

// The qualitative perks PLAN_LIMITS carries alongside the four numeric caps — these
// don't reduce to a usage bar (there's nothing to measure "used" against), so they're
// shown as a plain on/off pill row instead. Order matches the /pricing page's feature
// list (higher tiers add, never remove).
const FEATURE_PILLS: { key: 'removeBranding' | 'apiAccess' | 'customDomain'; label: string }[] = [
  { key: 'removeBranding', label: 'No Clickforms branding' },
  { key: 'apiAccess', label: 'API access' },
  { key: 'customDomain', label: 'Custom domain' },
];

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function SearchIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="7" cy="7" r="4.6" stroke="currentColor" strokeWidth="1.4" />
      <path d="M13 13l-2.5-2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export function BillingAdminClient({
  initialOrganizations,
}: {
  initialOrganizations: BillingOrgRow[];
}) {
  const [organizations, setOrganizations] = useState(initialOrganizations);
  const [search, setSearch] = useState('');
  const [busyOrgId, setBusyOrgId] = useState<string | null>(null);
  const toast = useToast();

  const visibleOrganizations = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return organizations;
    return organizations.filter(
      (org) => org.name.toLowerCase().includes(term) || org.subdomain.toLowerCase().includes(term),
    );
  }, [organizations, search]);

  async function handlePlanChange(org: BillingOrgRow, nextPlan: OrgPlan) {
    if (nextPlan === org.plan) return;
    setBusyOrgId(org.id);
    try {
      // Assigning a plan here is how a trialing org "graduates" — there's no self-serve
      // upgrade flow yet (see src/lib/auth.ts's OrganizationTrialExpired check), so if we
      // only patched `plan`, an org past its trialEndsAt would still get blocked at sign-in
      // even after an admin gave it a real plan. Flip status back to 'active' in the same
      // request whenever the org is currently trialing. Suspended orgs are left alone —
      // reactivating is a separate, explicit action (Organisations list kebab menu).
      const body: { plan: OrgPlan; status?: 'active' } =
        org.status === 'trial' ? { plan: nextPlan, status: 'active' } : { plan: nextPlan };
      const response = await fetch(`/api/admin/organizations/${org.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        throw new Error(await readApiError(response, 'Could not change plan'));
      }
      setOrganizations((current) =>
        current.map((row) =>
          row.id === org.id ? { ...row, plan: nextPlan, status: body.status ?? row.status } : row,
        ),
      );
      toast.success(`${org.name} moved to ${PLAN_LABELS[nextPlan]}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not change plan');
    } finally {
      setBusyOrgId(null);
    }
  }

  return (
    <div>
      <div className="forms-list-header">
        <div>
          <h1 className="settings-page-title">Billing &amp; plan limits</h1>
          <p className="settings-page-lead">
            Plan, usage against plan limits, and renewal date for every organisation.
          </p>
        </div>
      </div>

      <div className="card billing-search-card">
        <label className="forms-search">
          <span className="forms-search-icon">
            <SearchIcon />
          </span>
          <input
            type="text"
            placeholder="Search organisations…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label="Search organisations"
          />
        </label>
      </div>

      {visibleOrganizations.length === 0 ? (
        <div className="card empty-state">
          <p>No organisations match &ldquo;{search}&rdquo;.</p>
        </div>
      ) : (
        <div className="billing-org-grid">
          {visibleOrganizations.map((org) => {
            const bars = buildUsageBars(org.plan, org.usage);
            const limits = PLAN_LIMITS[org.plan];
            return (
              <div key={org.id} className="card billing-org-card">
                <div className="billing-org-card-header">
                  <div>
                    <Link href={`/admin/organisations/${org.id}`} className="admin-table-name-link">
                      {org.name}
                    </Link>
                    <p className="users-page-subtitle">{org.subdomain}</p>
                  </div>
                  <span className={`badge ${STATUS_BADGE_CLASS[org.status]}`}>
                    {org.status === 'trial'
                      ? 'Trial'
                      : org.status === 'suspended'
                        ? 'Suspended'
                        : 'Active'}
                  </span>
                </div>

                <div className="billing-org-card-plan">
                  <label className="billing-plan-label" htmlFor={`plan-${org.id}`}>
                    Plan
                  </label>
                  <select
                    id={`plan-${org.id}`}
                    className="text-input"
                    value={org.plan}
                    disabled={busyOrgId === org.id}
                    onChange={(event) => void handlePlanChange(org, event.target.value as OrgPlan)}
                  >
                    {PLAN_ORDER.map((plan) => (
                      <option key={plan} value={plan}>
                        {PLAN_LABELS[plan]}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="billing-usage-bars">
                  {bars.map((bar) => (
                    <div key={bar.label} className="usage-bar">
                      <div className="usage-bar-header">
                        <span>{bar.label}</span>
                        <span>{bar.formatted}</span>
                      </div>
                      <div className="usage-bar-track">
                        <div
                          className="usage-bar-fill"
                          style={{ width: `${bar.percent ?? 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="billing-feature-pills">
                  {FEATURE_PILLS.map((feature) => (
                    <span
                      key={feature.key}
                      className={`billing-feature-pill${limits[feature.key] ? ' billing-feature-pill--on' : ''}`}
                    >
                      {feature.label}
                    </span>
                  ))}
                </div>

                <div className="billing-org-card-footer">
                  {org.status === 'trial' ? (
                    <span>Trial ends {formatDate(org.trialEndsAt)}</span>
                  ) : (
                    <span>Renews {formatDate(org.renewsAt)}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
