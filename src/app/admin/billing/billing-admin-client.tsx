'use client';

import type { OrgPlan } from '@prisma/client';
import Link from 'next/link';
import { type ReactNode, useMemo, useState } from 'react';
import { LocalDate } from '@/components/local-date';
import { PLAN_LABELS, PLAN_ORDER } from '@/lib/admin/plan-limits';
import type { Attention, BillingState } from '@/lib/billing/overview';

export interface BillingOverviewRow {
  id: string;
  name: string;
  subdomain: string;
  plan: OrgPlan;
  state: BillingState;
  /** Null unless the organisation is billed through Stripe. */
  interval: 'month' | 'year' | null;
  /** Monthly recurring revenue in cents (GST inclusive, after running discounts). */
  mrrCents: number;
  discountLabel: string | null;
  /** Trial end for trials, otherwise the next renewal / period end. */
  date: string | null;
  cancelAtPeriodEnd: boolean;
  attention: Attention | null;
  overLimit: string[];
  nearLimit: string[];
  /** The most-used plan resource, or null when the plan is unlimited. */
  topUsage: { label: string; percent: number } | null;
}

export interface BillingActivityItem {
  id: string;
  text: string;
  organizationId: string | null;
  organizationName: string;
  actor: string;
  at: string;
}

const STATE_LABELS: Record<BillingState, string> = {
  subscribed: 'Subscribed',
  past_due: 'Payment failing',
  ended: 'Ended',
  trial: 'Trial',
  trial_expired: 'Trial expired',
  manual: 'Manual billing',
  suspended: 'Suspended',
};

const STATE_TONE: Record<BillingState, 'good' | 'warn' | 'bad' | 'muted'> = {
  subscribed: 'good',
  past_due: 'bad',
  ended: 'bad',
  trial: 'warn',
  trial_expired: 'bad',
  manual: 'muted',
  suspended: 'muted',
};

const FILTERS = ['all', 'subscribed', 'trial', 'manual', 'attention', 'suspended'] as const;
type Filter = (typeof FILTERS)[number];

const FILTER_LABELS: Record<Filter, string> = {
  all: 'All',
  subscribed: 'Subscribed',
  trial: 'Trials',
  manual: 'Manual billing',
  attention: 'Needs attention',
  suspended: 'Suspended',
};

const SORTS = ['attention', 'name', 'mrr', 'date'] as const;
type Sort = (typeof SORTS)[number];

const SORT_LABELS: Record<Sort, string> = {
  attention: 'Needs attention first',
  name: 'Name',
  mrr: 'Highest MRR',
  date: 'Soonest date',
};

function matchesFilter(row: BillingOverviewRow, filter: Filter): boolean {
  switch (filter) {
    case 'all':
      return true;
    case 'subscribed':
      return row.state === 'subscribed' || row.state === 'past_due' || row.state === 'ended';
    case 'trial':
      return row.state === 'trial' || row.state === 'trial_expired';
    case 'manual':
      return row.state === 'manual';
    case 'attention':
      return row.attention !== null;
    case 'suspended':
      return row.state === 'suspended';
  }
}

function attentionRank(row: BillingOverviewRow): number {
  if (row.attention?.severity === 'urgent') return 0;
  if (row.attention) return 1;
  return 2;
}

function money(cents: number): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : (parts[0]?.[1] ?? '');
  return `${first}${last}`.toUpperCase();
}

function stateDateLabel(row: BillingOverviewRow): string {
  if (row.state === 'trial') return 'Trial ends';
  if (row.state === 'trial_expired') return 'Trial ended';
  if (row.cancelAtPeriodEnd) return 'Cancels';
  if (row.state === 'ended') return 'Ended';
  return 'Renews';
}

function csvCell(value: string | number): string {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function exportCsv(rows: BillingOverviewRow[]) {
  const header = [
    'Organisation',
    'Subdomain',
    'Plan',
    'Billing state',
    'Interval',
    'Discount',
    'MRR (AUD, GST incl.)',
    'Date label',
    'Date',
    'Top usage',
    'Attention',
  ];
  const lines = rows.map((row) =>
    [
      row.name,
      row.subdomain,
      PLAN_LABELS[row.plan],
      STATE_LABELS[row.state],
      row.interval ?? '',
      row.discountLabel ?? '',
      (row.mrrCents / 100).toFixed(2),
      row.date ? stateDateLabel(row) : '',
      row.date ? row.date.slice(0, 10) : '',
      row.topUsage ? `${row.topUsage.label} ${row.topUsage.percent}%` : 'Unlimited',
      row.attention?.message ?? '',
    ]
      .map(csvCell)
      .join(','),
  );
  const blob = new Blob([`${[header.join(','), ...lines].join('\n')}\n`], {
    type: 'text/csv;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `clickforms-billing-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

// --- Icons -----------------------------------------------------------------------------

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

const TrendIcon = () => (
  <Icon>
    <path d="M2.5 14.5 7.5 9l3 3 6-7" />
    <path d="M12.5 5h4v4" />
  </Icon>
);
const UsersIcon = () => (
  <Icon>
    <circle cx="8" cy="7" r="3" />
    <path d="M2.5 16c.5-3 2.7-4.5 5.5-4.5s5 1.5 5.5 4.5" />
    <path d="M13.5 4.4a3 3 0 0 1 0 5.2M15.5 11.8c1.2.7 1.9 1.9 2.2 3.7" />
  </Icon>
);
const ClockIcon = () => (
  <Icon>
    <circle cx="10" cy="10" r="7" />
    <path d="M10 6v4.2l2.8 1.6" />
  </Icon>
);
const AlertIcon = () => (
  <Icon>
    <path d="M10 3 2.5 16h15L10 3Z" />
    <path d="M10 8.5v3.2M10 14h.01" />
  </Icon>
);
const SearchIcon = () => (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <circle cx="7" cy="7" r="4.6" stroke="currentColor" strokeWidth="1.4" />
    <path d="M13 13l-2.5-2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
  </svg>
);
const DownloadIcon = () => (
  <Icon>
    <path d="M10 3v9M6.5 8.5 10 12l3.5-3.5M4 15.5h12" />
  </Icon>
);
const ChevronRight = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path
      d="M6 3.5 10.5 8 6 12.5"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

// --- Page ------------------------------------------------------------------------------

export function BillingAdminClient({
  rows,
  activity,
}: {
  rows: BillingOverviewRow[];
  activity: BillingActivityItem[];
}) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [sort, setSort] = useState<Sort>('attention');

  const summary = useMemo(() => {
    const paying = rows.filter((row) => row.state === 'subscribed' || row.state === 'past_due');
    const atRisk = rows.filter((row) => row.state === 'past_due');
    const trials = rows.filter((row) => row.state === 'trial');
    const now = Date.now();
    return {
      mrrCents: paying.reduce((sum, row) => sum + row.mrrCents, 0),
      subscribers: paying.length,
      annual: paying.filter((row) => row.interval === 'year').length,
      trials: trials.length,
      trialsEndingSoon: trials.filter(
        (row) => row.date && new Date(row.date).getTime() - now <= 3 * 86_400_000,
      ).length,
      manual: rows.filter((row) => row.state === 'manual').length,
      atRiskCount: atRisk.length,
      atRiskCents: atRisk.reduce((sum, row) => sum + row.mrrCents, 0),
      attention: rows.filter((row) => row.attention !== null).length,
      urgent: rows.filter((row) => row.attention?.severity === 'urgent').length,
    };
  }, [rows]);

  const revenueByPlan = useMemo(() => {
    const paying = rows.filter((row) => row.state === 'subscribed' || row.state === 'past_due');
    const total = paying.reduce((sum, row) => sum + row.mrrCents, 0);
    return {
      total,
      plans: PLAN_ORDER.map((plan) => {
        const members = paying.filter((row) => row.plan === plan);
        const mrr = members.reduce((sum, row) => sum + row.mrrCents, 0);
        return { plan, count: members.length, mrr, share: total > 0 ? mrr / total : 0 };
      }),
    };
  }, [rows]);

  const upcoming = useMemo(() => {
    const now = Date.now();
    const horizon = now + 30 * 86_400_000;
    return rows
      .filter(
        (row) =>
          row.date &&
          (row.state === 'subscribed' || row.state === 'past_due' || row.state === 'trial') &&
          new Date(row.date).getTime() <= horizon &&
          new Date(row.date).getTime() >= now - 86_400_000,
      )
      .sort((a, b) => new Date(a.date ?? 0).getTime() - new Date(b.date ?? 0).getTime())
      .slice(0, 6);
  }, [rows]);

  const attentionRows = useMemo(
    () =>
      rows
        .filter((row) => row.attention !== null)
        .sort((a, b) => attentionRank(a) - attentionRank(b)),
    [rows],
  );

  const counts = useMemo(() => {
    const result = {} as Record<Filter, number>;
    for (const key of FILTERS) result[key] = rows.filter((row) => matchesFilter(row, key)).length;
    return result;
  }, [rows]);

  const visibleRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    const filtered = rows.filter((row) => {
      if (!matchesFilter(row, filter)) return false;
      if (!term) return true;
      return row.name.toLowerCase().includes(term) || row.subdomain.toLowerCase().includes(term);
    });
    const time = (row: BillingOverviewRow) =>
      row.date ? new Date(row.date).getTime() : Number.POSITIVE_INFINITY;
    return [...filtered].sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name);
      if (sort === 'mrr') return b.mrrCents - a.mrrCents || a.name.localeCompare(b.name);
      if (sort === 'date') return time(a) - time(b) || a.name.localeCompare(b.name);
      return attentionRank(a) - attentionRank(b) || a.name.localeCompare(b.name);
    });
  }, [rows, search, filter, sort]);

  return (
    <div className="bo">
      <header className="bo-header">
        <div>
          <h1 className="bo-title">Billing</h1>
        </div>
        <div className="bo-header-actions">
          <button type="button" className="button button--ghost" onClick={() => exportCsv(rows)}>
            <DownloadIcon /> Export CSV
          </button>
          <Link href="/admin/billing/promotions" className="button button--dark">
            Promotion codes
          </Link>
        </div>
      </header>

      <section className="bo-kpis" aria-label="Billing summary">
        <article className="bo-kpi">
          <span className="bo-kpi-icon bo-kpi-icon--green">
            <TrendIcon />
          </span>
          <div>
            <p className="bo-kpi-label">Monthly revenue</p>
            <p className="bo-kpi-value">{money(summary.mrrCents)}</p>
            <p className="bo-kpi-note">{money(summary.mrrCents * 12)} a year</p>
          </div>
        </article>
        <article className="bo-kpi">
          <span className="bo-kpi-icon bo-kpi-icon--blue">
            <UsersIcon />
          </span>
          <div>
            <p className="bo-kpi-label">Subscribers</p>
            <p className="bo-kpi-value">{summary.subscribers}</p>
            <p className="bo-kpi-note">
              {summary.annual} annual · {summary.subscribers - summary.annual} monthly
            </p>
          </div>
        </article>
        <article className="bo-kpi">
          <span className="bo-kpi-icon bo-kpi-icon--amber">
            <ClockIcon />
          </span>
          <div>
            <p className="bo-kpi-label">Trials</p>
            <p className="bo-kpi-value">{summary.trials}</p>
            <p className="bo-kpi-note">
              {summary.trialsEndingSoon > 0
                ? `${summary.trialsEndingSoon} ending soon`
                : `${summary.manual} on manual billing`}
            </p>
          </div>
        </article>
        <article className={`bo-kpi${summary.urgent > 0 ? ' bo-kpi--alert' : ''}`}>
          <span className="bo-kpi-icon bo-kpi-icon--red">
            <AlertIcon />
          </span>
          <div>
            <p className="bo-kpi-label">Needs attention</p>
            <p className="bo-kpi-value">{summary.attention}</p>
            <p className="bo-kpi-note">
              {summary.atRiskCount > 0
                ? `${money(summary.atRiskCents)}/mo at risk`
                : summary.urgent > 0
                  ? `${summary.urgent} urgent`
                  : 'All healthy'}
            </p>
          </div>
        </article>
      </section>

      <div className="bo-insights">
        <section className="bo-card" aria-label="Revenue by plan">
          <header className="bo-card-head">
            <h2>Revenue by plan</h2>
            <span className="bo-card-meta">{money(revenueByPlan.total)}/mo</span>
          </header>
          {revenueByPlan.total === 0 ? (
            <p className="bo-empty">No paying subscribers yet.</p>
          ) : (
            <ul className="bo-plan-bars">
              {revenueByPlan.plans.map((entry) => (
                <li key={entry.plan}>
                  <div className="bo-plan-bar-head">
                    <span>{PLAN_LABELS[entry.plan]}</span>
                    <span>
                      {entry.count} {entry.count === 1 ? 'org' : 'orgs'} · {money(entry.mrr)}
                    </span>
                  </div>
                  <div className="bo-bar">
                    <div
                      className="bo-bar-fill"
                      style={{ width: `${Math.round(entry.share * 100)}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="bo-card" aria-label="Upcoming">
          <header className="bo-card-head">
            <h2>Coming up</h2>
          </header>
          {upcoming.length === 0 ? (
            <p className="bo-empty">Nothing in the next 30 days.</p>
          ) : (
            <ul className="bo-list">
              {upcoming.map((row) => (
                <li key={row.id} className="bo-list-row">
                  <span className="bo-avatar" aria-hidden="true">
                    {initials(row.name)}
                  </span>
                  <div className="bo-list-copy">
                    <Link href={`/admin/organisations/${row.id}#admin-org-billing`}>
                      {row.name}
                    </Link>
                    <span>
                      {stateDateLabel(row)} {row.date ? <LocalDate iso={row.date} /> : null}
                    </span>
                  </div>
                  <span className="bo-list-amount">
                    {row.state === 'trial'
                      ? 'Trial'
                      : row.mrrCents > 0
                        ? money(row.mrrCents * (row.interval === 'year' ? 12 : 1))
                        : ''}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {attentionRows.length > 0 ? (
        <section className="bo-card" aria-label="Needs attention">
          <header className="bo-card-head">
            <h2>Needs attention</h2>
          </header>
          <ul className="bo-list">
            {attentionRows.map((row) => (
              <li key={row.id} className="bo-list-row">
                <span className={`bo-dot bo-dot--${row.attention?.severity}`} aria-hidden="true" />
                <div className="bo-list-copy">
                  <Link href={`/admin/organisations/${row.id}#admin-org-billing`}>{row.name}</Link>
                  <span>{row.attention?.message}</span>
                </div>
                <Link
                  href={`/admin/organisations/${row.id}#admin-org-billing`}
                  className="button button--ghost bo-small"
                >
                  {row.state === 'past_due' ? 'Retry payment' : 'Open billing'}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="bo-card bo-card--flush" aria-label="Organisations">
        <header className="bo-toolbar">
          <fieldset className="bo-tabs" aria-label="Filter organisations">
            {FILTERS.map((key) => (
              <button
                key={key}
                type="button"
                className={`bo-tab${filter === key ? ' bo-tab--active' : ''}`}
                aria-pressed={filter === key}
                onClick={() => setFilter(key)}
              >
                {FILTER_LABELS[key]}
                <span className="bo-tab-count">{counts[key]}</span>
              </button>
            ))}
          </fieldset>
          <div className="bo-toolbar-right">
            <label className="bo-select">
              <span className="bo-visually-hidden">Sort by</span>
              <select value={sort} onChange={(event) => setSort(event.target.value as Sort)}>
                {SORTS.map((key) => (
                  <option key={key} value={key}>
                    {SORT_LABELS[key]}
                  </option>
                ))}
              </select>
            </label>
            <label className="bo-search">
              <SearchIcon />
              <input
                type="text"
                placeholder="Search organisations"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                aria-label="Search organisations"
              />
            </label>
          </div>
        </header>

        {visibleRows.length === 0 ? (
          <p className="bo-empty bo-empty--pad">
            {search.trim() ? `No organisations match “${search.trim()}”.` : 'No organisations.'}
          </p>
        ) : (
          <div className="bo-table-wrap">
            <table className="bo-table">
              <thead>
                <tr>
                  <th>Organisation</th>
                  <th>Plan</th>
                  <th>Billing</th>
                  <th className="bo-num">MRR</th>
                  <th>Date</th>
                  <th>Plan usage</th>
                  <th aria-label="Open" />
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <div className="bo-org">
                        <span className="bo-avatar" aria-hidden="true">
                          {initials(row.name)}
                        </span>
                        <div>
                          <Link
                            href={`/admin/organisations/${row.id}#admin-org-billing`}
                            className="bo-org-name"
                          >
                            {row.name}
                          </Link>
                          <span className="bo-muted">{row.subdomain}</span>
                        </div>
                      </div>
                    </td>
                    <td>{PLAN_LABELS[row.plan]}</td>
                    <td>
                      <span className={`bo-pill bo-pill--${STATE_TONE[row.state]}`}>
                        {STATE_LABELS[row.state]}
                      </span>
                      {row.interval || row.discountLabel ? (
                        <span className="bo-muted">
                          {[
                            row.interval === 'year'
                              ? 'Annual'
                              : row.interval === 'month'
                                ? 'Monthly'
                                : null,
                            row.discountLabel,
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </span>
                      ) : null}
                    </td>
                    <td className="bo-num">
                      {row.mrrCents > 0 ? (
                        money(row.mrrCents)
                      ) : (
                        <span className="bo-muted">None</span>
                      )}
                    </td>
                    <td>
                      {row.date ? (
                        <>
                          <span className="bo-muted">{stateDateLabel(row)}</span>
                          <LocalDate iso={row.date} />
                        </>
                      ) : (
                        <span className="bo-muted">None</span>
                      )}
                    </td>
                    <td>
                      {row.topUsage ? (
                        <div className="bo-usage">
                          <div className="bo-usage-head">
                            <span>{row.topUsage.label}</span>
                            <span>{row.topUsage.percent}%</span>
                          </div>
                          <div className="bo-bar">
                            <div
                              className={`bo-bar-fill${
                                row.topUsage.percent > 100
                                  ? ' bo-bar-fill--bad'
                                  : row.topUsage.percent >= 90
                                    ? ' bo-bar-fill--warn'
                                    : ''
                              }`}
                              style={{ width: `${Math.min(100, row.topUsage.percent)}%` }}
                            />
                          </div>
                        </div>
                      ) : (
                        <span className="bo-muted">Unlimited</span>
                      )}
                    </td>
                    <td className="bo-action">
                      <Link
                        href={`/admin/organisations/${row.id}#admin-org-billing`}
                        className="bo-manage"
                        aria-label={`Manage billing for ${row.name}`}
                      >
                        Manage <ChevronRight />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="bo-card" aria-label="Activity">
        <header className="bo-card-head">
          <h2>Activity</h2>
          <Link href="/admin/audit-log" className="bo-card-link">
            View all
          </Link>
        </header>
        {activity.length === 0 ? (
          <p className="bo-empty">No activity yet.</p>
        ) : (
          <ul className="bo-list">
            {activity.map((item) => (
              <li key={item.id} className="bo-list-row">
                <span className="bo-dot bo-dot--info" aria-hidden="true" />
                <div className="bo-list-copy">
                  <span className="bo-list-strong">
                    {item.text}
                    {item.organizationId ? (
                      <>
                        {' for '}
                        <Link
                          href={`/admin/organisations/${item.organizationId}#admin-org-billing`}
                        >
                          {item.organizationName}
                        </Link>
                      </>
                    ) : null}
                  </span>
                  <span>{item.actor}</span>
                </div>
                <span className="bo-muted bo-nowrap">
                  <LocalDate iso={item.at} />
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
