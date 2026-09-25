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

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
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

export function BillingAdminClient({
  initialOrganizations,
}: {
  initialOrganizations: BillingOrgRow[];
}) {
  const [organizations, setOrganizations] = useState(initialOrganizations);
  const [search, setSearch] = useState('');

  const visibleOrganizations = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return organizations;
    return organizations.filter(
      (org) => org.name.toLowerCase().includes(term) || org.subdomain.toLowerCase().includes(term),
    );
  }, [organizations, search]);

  function handleSaved(updated: BillingOrgRow) {
    setOrganizations((current) => current.map((row) => (row.id === updated.id ? updated : row)));
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
            status === 'trial' ? new Date(`${trialEndsAt}T00:00:00`).toISOString() : null,
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

  return (
    <div className="card billing-org-card">
      <div className="billing-org-card-header">
        <div>
          <Link href={`/admin/organisations/${org.id}`} className="admin-table-name-link">
            {org.name}
          </Link>
          <p className="users-page-subtitle">{org.subdomain}</p>
        </div>
        <span className={`badge ${STATUS_BADGE_CLASS[org.status]}`}>
          {STATUS_LABELS[org.status]}
        </span>
      </div>

      <div className="billing-org-card-form">
        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}
        <div className="billing-org-card-fields-row">
          <label className="admin-org-field">
            <span>Plan</span>
            <select
              className="text-input"
              value={plan}
              disabled={isSaving}
              onChange={(event) => setPlan(event.target.value as OrgPlan)}
            >
              {PLAN_ORDER.map((planOption) => (
                <option key={planOption} value={planOption}>
                  {PLAN_LABELS[planOption]}
                </option>
              ))}
            </select>
          </label>
          <label className="admin-org-field">
            <span>Status</span>
            <select
              className="text-input"
              value={status}
              disabled={isSaving}
              onChange={(event) => handleStatusChange(event.target.value as OrgStatus)}
            >
              {(Object.keys(STATUS_LABELS) as OrgStatus[]).map((statusOption) => (
                <option key={statusOption} value={statusOption}>
                  {STATUS_LABELS[statusOption]}
                </option>
              ))}
            </select>
          </label>
        </div>
        {status === 'trial' ? (
          <label className="admin-org-field">
            <span>Trial ends on</span>
            <input
              className="text-input"
              type="date"
              value={trialEndsAt}
              disabled={isSaving}
              onChange={(event) => setTrialEndsAt(event.target.value)}
              required
            />
          </label>
        ) : null}
        <div className="billing-org-card-actions">
          <button
            type="button"
            className="button button--dark button--small"
            disabled={isSaving || !isDirty}
            onClick={() => void handleSave()}
          >
            {isSaving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      <div className="billing-usage-bars">
        {bars.map((bar) => (
          <div key={bar.label} className="usage-bar">
            <div className="usage-bar-header">
              <span>{bar.label}</span>
              <span>{bar.formatted}</span>
            </div>
            <div className="usage-bar-track">
              <div className="usage-bar-fill" style={{ width: `${bar.percent ?? 100}%` }} />
            </div>
          </div>
        ))}
      </div>

      <div className="billing-feature-pills">
        {PLAN_FEATURE_PILLS.map((feature) => (
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
}
