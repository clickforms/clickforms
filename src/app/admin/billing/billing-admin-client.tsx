'use client';

import type { OrgPlan, OrgStatus } from '@prisma/client';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useToast } from '@/components/toast';
import {
  buildUsageBars,
  PLAN_FEATURE_PILLS,
  PLAN_LABELS,
  PLAN_LIMITS,
  PLAN_ORDER,
} from '@/lib/admin/plan-limits';
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

const STATUS_LABELS: Record<OrgStatus, string> = {
  active: 'Active',
  trial: 'Trial',
  suspended: 'Suspended',
};

const STATUS_FILTERS = ['all', 'active', 'trial', 'suspended'] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

const STATUS_FILTER_LABELS: Record<StatusFilter, string> = {
  all: 'All',
  active: 'Active',
  trial: 'Trial',
  suspended: 'Suspended',
};

function formatDate(iso: string | null): string {
  if (!iso) return '';
  return new Date(`${iso.slice(0, 10)}T00:00:00.000Z`).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : (parts[0]?.[1] ?? '');
  return `${first}${last}`.toUpperCase();
}

function getTrialDaysRemaining(trialEndsAt: string | null, status: OrgStatus): number | null {
  if (status !== 'trial' || !trialEndsAt) return null;
  const now = new Date();
  const [year, month, day] = trialEndsAt.slice(0, 10).split('-').map(Number);
  const todayUtc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const trialUtc = Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1);
  return Math.round((trialUtc - todayUtc) / (24 * 60 * 60 * 1000));
}

function trialLabel(daysRemaining: number | null): string | null {
  if (daysRemaining === null) return null;
  if (daysRemaining < 0) return 'Expired';
  if (daysRemaining === 0) return 'Expires today';
  if (daysRemaining === 1) return '1 day left';
  if (daysRemaining <= 7) return `${daysRemaining} days left`;
  return null;
}

function toDateInputValue(iso: string | null): string {
  return iso ? iso.slice(0, 10) : '';
}

// Same default as the Organisations detail page's own Plan & trial panel (see
// defaultTrialEndDate there) — matches the signup flow's 7-day trial so picking "Trial"
// here isn't left with an empty, unsavable date, while staying fully editable to any
// custom length an admin wants to grant.
function defaultTrialEndDate(): string {
  const date = new Date();
  date.setDate(date.getDate() + 7);
  return date.toISOString().slice(0, 10);
}

function SearchIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="7" cy="7" r="4.6" stroke="currentColor" strokeWidth="1.4" />
      <path d="M13 13l-2.5-2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M3.5 8.5 6.5 11.5 12.5 5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
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
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const statusCounts = useMemo(() => {
    const counts: Record<StatusFilter, number> = {
      all: organizations.length,
      active: 0,
      trial: 0,
      suspended: 0,
    };
    for (const org of organizations) {
      counts[org.status] += 1;
    }
    return counts;
  }, [organizations]);

  const urgentTrialCount = useMemo(
    () =>
      organizations.filter((org) => {
        const days = getTrialDaysRemaining(org.trialEndsAt, org.status);
        return days !== null && days <= 7;
      }).length,
    [organizations],
  );

  const visibleOrganizations = useMemo(() => {
    const term = search.trim().toLowerCase();
    return organizations.filter((org) => {
      if (statusFilter !== 'all' && org.status !== statusFilter) return false;
      if (!term) return true;
      return org.name.toLowerCase().includes(term) || org.subdomain.toLowerCase().includes(term);
    });
  }, [organizations, search, statusFilter]);

  function handleSaved(updated: BillingOrgRow) {
    setOrganizations((current) => current.map((row) => (row.id === updated.id ? updated : row)));
  }

  return (
    <div className="billing-page admin-orgs-directory">
      <header className="admin-orgs-header">
        <div>
          <h1 className="admin-orgs-title">Billing</h1>
          <p className="admin-orgs-lead">Plan, usage, and trial for every organisation.</p>
        </div>
        <label className="admin-orgs-search billing-page-search">
          <span className="admin-orgs-search-icon">
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
      </header>

      {organizations.length > 0 ? (
        <section className="admin-orgs-directory-stats" aria-label="Billing snapshot">
          {STATUS_FILTERS.map((filter) => (
            <button
              key={filter}
              type="button"
              className={`admin-orgs-directory-stat${
                statusFilter === filter ? ' admin-orgs-directory-stat--active' : ''
              }${filter === 'trial' && urgentTrialCount > 0 ? ' admin-orgs-directory-stat--alert' : ''}`}
              onClick={() => setStatusFilter(filter)}
            >
              <span className="admin-orgs-directory-stat-value">{statusCounts[filter]}</span>
              <span className="admin-orgs-directory-stat-label">
                {STATUS_FILTER_LABELS[filter]}
                {filter === 'trial' && urgentTrialCount > 0 ? (
                  <span className="admin-orgs-directory-stat-note">
                    {urgentTrialCount} need review
                  </span>
                ) : null}
              </span>
            </button>
          ))}
        </section>
      ) : null}

      {visibleOrganizations.length === 0 ? (
        <div className="org-panel billing-empty">
          <p>
            {search.trim() ? `No organisations match “${search.trim()}”.` : 'No organisations yet.'}
          </p>
        </div>
      ) : (
        <div className="billing-org-list">
          {visibleOrganizations.map((org) => (
            <BillingOrgCard key={org.id} org={org} onSaved={handleSaved} />
          ))}
        </div>
      )}
    </div>
  );
}

function BillingOrgCard({
  org,
  onSaved,
}: {
  org: BillingOrgRow;
  onSaved: (updated: BillingOrgRow) => void;
}) {
  const toast = useToast();
  const bars = buildUsageBars(org.plan, org.usage);
  const limits = PLAN_LIMITS[org.plan];

  // Draft plan/status/trial fields, separate from `org` (the committed, saved values shown
  // in the header badge, usage bars, and footer) — same split as the Organisations detail
  // page's "Plan & trial" panel, so nothing here takes effect until Save is pressed. This is
  // also what lets a plan change and a trial start/extend/end happen as one atomic PATCH
  // instead of two separate requests racing each other.
  const [plan, setPlan] = useState<OrgPlan>(org.plan);
  const [status, setStatus] = useState<OrgStatus>(org.status);
  const [trialEndsAt, setTrialEndsAt] = useState(
    org.status === 'trial' ? toDateInputValue(org.trialEndsAt) : '',
  );
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isDirty = useMemo(() => {
    const currentTrialEndsAt = org.status === 'trial' ? toDateInputValue(org.trialEndsAt) : '';
    const nextTrialEndsAt = status === 'trial' ? trialEndsAt : '';
    return plan !== org.plan || status !== org.status || nextTrialEndsAt !== currentTrialEndsAt;
  }, [plan, status, trialEndsAt, org]);

  function handleStatusChange(nextStatus: OrgStatus) {
    setStatus(nextStatus);
    if (nextStatus === 'trial' && !trialEndsAt) {
      setTrialEndsAt(defaultTrialEndDate());
    }
  }

  async function handleSave() {
    setError(null);
    if (status === 'trial' && !trialEndsAt) {
      setError('Trial end date is required while status is Trial');
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch(`/api/admin/organizations/${org.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan,
          status,
          // Cleared the moment status isn't 'trial', same as the detail page — a stale date
          // shouldn't linger once an org leaves trial (see isTrialExpired in plan-limits.ts).
          trialEndsAt:
            status === 'trial' ? new Date(`${trialEndsAt}T23:59:59.999`).toISOString() : null,
        }),
      });
      if (!response.ok) {
        setError(await readApiError(response, 'Could not save plan & trial settings'));
        return;
      }
      const data: {
        organization: {
          plan: OrgPlan;
          status: OrgStatus;
          trialEndsAt: string | null;
          renewsAt: string | null;
        };
      } = await response.json();
      onSaved({
        ...org,
        plan: data.organization.plan,
        status: data.organization.status,
        trialEndsAt: data.organization.trialEndsAt,
        renewsAt: data.organization.renewsAt,
      });
      toast.success(`${org.name} updated`);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }

  const daysRemaining = getTrialDaysRemaining(org.trialEndsAt, org.status);
  const urgentTrial = trialLabel(daysRemaining);
  const renewalLabel =
    org.status === 'trial' && org.trialEndsAt
      ? daysRemaining === 0
        ? 'Trial ends today'
        : `Trial through ${formatDate(org.trialEndsAt)}`
      : org.renewsAt
        ? `Renews ${formatDate(org.renewsAt)}`
        : null;

  return (
    <article
      className={`org-panel billing-org-card${urgentTrial ? ' billing-org-card--alert' : ''}`}
    >
      <header className="billing-org-head">
        <div className="billing-org-identity">
          <span className="admin-orgs-directory-mark" aria-hidden="true">
            {getInitials(org.name)}
          </span>
          <div>
            <Link href={`/admin/organisations/${org.id}`} className="billing-org-name">
              {org.name}
            </Link>
            <p className="billing-org-subdomain">
              {org.subdomain}
              {' · '}
              {PLAN_LABELS[org.plan]}
            </p>
          </div>
        </div>
        <div className="billing-org-head-meta">
          {urgentTrial ? (
            <span
              className={`billing-org-trial${
                daysRemaining !== null && daysRemaining < 0 ? ' billing-org-trial--expired' : ''
              }`}
            >
              {urgentTrial}
            </span>
          ) : renewalLabel ? (
            <span className="billing-org-renewal">{renewalLabel}</span>
          ) : null}
          <span className={`badge ${STATUS_BADGE_CLASS[org.status]}`}>
            {STATUS_LABELS[org.status]}
          </span>
        </div>
      </header>

      <div className="billing-org-controls">
        {error ? (
          <p className="form-error billing-org-error" role="alert">
            {error}
          </p>
        ) : null}

        <div className="billing-org-control-row">
          <div className="billing-org-control">
            <span className="billing-org-control-label">Plan</span>
            <fieldset className="billing-chip-row" aria-label="Plan">
              {PLAN_ORDER.map((planOption) => (
                <button
                  key={planOption}
                  type="button"
                  className={`billing-chip${plan === planOption ? ' billing-chip--selected' : ''}`}
                  disabled={isSaving}
                  aria-pressed={plan === planOption}
                  onClick={() => setPlan(planOption)}
                >
                  {PLAN_LABELS[planOption]}
                </button>
              ))}
            </fieldset>
          </div>
          <div className="billing-org-control">
            <span className="billing-org-control-label">Status</span>
            <fieldset className="billing-chip-row" aria-label="Status">
              {(Object.keys(STATUS_LABELS) as OrgStatus[]).map((statusOption) => (
                <button
                  key={statusOption}
                  type="button"
                  className={`billing-chip${status === statusOption ? ` billing-chip--selected billing-chip--${statusOption}` : ''}`}
                  disabled={isSaving}
                  aria-pressed={status === statusOption}
                  onClick={() => handleStatusChange(statusOption)}
                >
                  {STATUS_LABELS[statusOption]}
                </button>
              ))}
            </fieldset>
          </div>
          {status === 'trial' ? (
            <label className="billing-org-control">
              <span className="billing-org-control-label">Trial ends</span>
              <input
                className="text-input org-input billing-trial-input"
                type="date"
                value={trialEndsAt}
                disabled={isSaving}
                onChange={(event) => setTrialEndsAt(event.target.value)}
                required
              />
            </label>
          ) : null}
          <div className="billing-org-save">
            <button
              type="button"
              className="button button--dark"
              disabled={isSaving || !isDirty}
              onClick={() => void handleSave()}
            >
              {isSaving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>

      <div className="org-usage-grid billing-org-usage">
        {bars.map((bar) => {
          const overLimit = bar.limit !== null && bar.used > bar.limit;
          return (
            <div
              key={bar.label}
              className={`org-usage-card${overLimit ? ' org-usage-card--over' : ''}`}
            >
              <div className="org-usage-card-head">
                <span>{bar.label}</span>
                <strong>{bar.percent === null ? 'Unlimited' : `${bar.percent}%`}</strong>
              </div>
              <p className="org-usage-card-value">{bar.formatted}</p>
              <div className="org-usage-track">
                <div
                  className={`org-usage-fill${overLimit ? ' org-usage-fill--over' : ''}`}
                  style={{ width: `${bar.percent ?? 100}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <footer className="billing-org-footer">
        <ul className="billing-org-features">
          {PLAN_FEATURE_PILLS.map((feature) => {
            const on = limits[feature.key];
            return (
              <li
                key={feature.key}
                className={on ? 'billing-org-feature--on' : 'billing-org-feature--off'}
              >
                {on ? <CheckIcon /> : null}
                {feature.label}
              </li>
            );
          })}
        </ul>
      </footer>
    </article>
  );
}
