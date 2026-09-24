'use client';

import type { OrgPlan, OrgStatus } from '@prisma/client';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useToast } from '@/components/toast';
import { buildUsageBars, PLAN_LABELS, PLAN_ORDER } from '@/lib/admin/plan-limits';
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
      const response = await fetch(`/api/admin/organizations/${org.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: nextPlan }),
      });
      if (!response.ok) {
        throw new Error(await readApiError(response, 'Could not change plan'));
      }
      setOrganizations((current) =>
        current.map((row) => (row.id === org.id ? { ...row, plan: nextPlan } : row)),
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
