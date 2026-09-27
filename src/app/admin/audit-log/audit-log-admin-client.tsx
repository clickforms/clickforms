'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

export interface AuditLogRow {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  createdAt: string;
  organizationId: string | null;
  organizationName: string;
  actorName: string;
}

const PAGE_SIZE = 25;

const ACTION_LABELS: Record<string, string> = {
  organization_create: 'Created organisation',
  organization_update: 'Updated organisation',
  organization_delete: 'Deleted organisation',
  joined_organization: 'Joined organisation',
  left_organization: 'Left organisation',
  logo_update: 'Updated logo',
  logo_remove: 'Removed logo',
  invite_accept: 'Accepted invite',
  invite: 'Sent invite',
  user_invite: 'Invited user',
  user_create: 'Created user',
  user_update: 'Updated user',
  user_remove: 'Removed user',
  update: 'Updated organisation',
  details_update: 'Updated details',
  plan_change: 'Changed plan',
};

/** "admin.organization_create" -> category "admin". Categories are derived from
 * whatever action strings actually exist rather than a hardcoded list, since every
 * route that calls logAudit() can introduce a new prefix (see src/lib/audit.ts). */
function actionCategory(action: string): string {
  return action.split('.')[0] ?? action;
}

function formatCategory(category: string): string {
  if (category === 'all') return 'All';
  const words = category
    .split('_')
    .join(' ')
    .replace(/organization/g, 'organisation');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function formatAction(action: string): string {
  const verb = action.split('.').pop() ?? action;
  if (ACTION_LABELS[verb]) return ACTION_LABELS[verb];
  const words = verb
    .split('_')
    .join(' ')
    .replace(/organization/g, 'organisation');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function formatEntity(entityType: string): string {
  const words = entityType
    .split('_')
    .join(' ')
    .replace(/organization/g, 'organisation');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function actorInitial(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return 'S';
  const parts = trimmed.split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? 'S';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return `${first}${last}`.toUpperCase();
}

function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const seconds = Math.round((Date.now() - then) / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
}

function formatExactTime(iso: string): string {
  return new Date(iso).toLocaleString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
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

export function AuditLogAdminClient({ initialEntries }: { initialEntries: AuditLogRow[] }) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string>('all');
  const [page, setPage] = useState(1);

  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const entry of initialEntries) {
      const cat = actionCategory(entry.action);
      counts.set(cat, (counts.get(cat) ?? 0) + 1);
    }
    return [
      { key: 'all', label: 'All', count: initialEntries.length },
      ...Array.from(counts.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([key, count]) => ({ key, label: formatCategory(key), count })),
    ];
  }, [initialEntries]);

  const visibleEntries = useMemo(() => {
    const term = search.trim().toLowerCase();
    return initialEntries.filter((entry) => {
      if (category !== 'all' && actionCategory(entry.action) !== category) return false;
      if (!term) return true;
      return (
        entry.action.toLowerCase().includes(term) ||
        entry.organizationName.toLowerCase().includes(term) ||
        entry.actorName.toLowerCase().includes(term) ||
        entry.entityType.toLowerCase().includes(term)
      );
    });
  }, [initialEntries, search, category]);

  const totalPages = Math.max(1, Math.ceil(visibleEntries.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageEntries = visibleEntries.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <div className="admin-orgs admin-orgs-directory admin-audit-directory">
      <header className="admin-orgs-header">
        <div>
          <h1 className="admin-orgs-title">Audit log</h1>
          <p className="admin-orgs-lead">
            Every logged admin and organisation action, most recent first (last{' '}
            {initialEntries.length}).
          </p>
        </div>
      </header>

      {initialEntries.length > 0 ? (
        <section className="admin-audit-stats" aria-label="Audit log snapshot">
          {categories.map((cat) => (
            <button
              key={cat.key}
              type="button"
              className={`admin-orgs-directory-stat${
                category === cat.key ? ' admin-orgs-directory-stat--active' : ''
              }`}
              onClick={() => {
                setCategory(cat.key);
                setPage(1);
              }}
            >
              <span className="admin-orgs-directory-stat-value">{cat.count}</span>
              <span className="admin-orgs-directory-stat-label">{cat.label}</span>
            </button>
          ))}
        </section>
      ) : null}

      <div className="card admin-orgs-card">
        <div className="admin-orgs-toolbar">
          <label className="admin-orgs-search">
            <span className="admin-orgs-search-icon">
              <SearchIcon />
            </span>
            <input
              type="text"
              placeholder="Search by action, organisation, or actor…"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              aria-label="Search audit log"
            />
          </label>
        </div>
        <div className="admin-table-scroll">
          <table className="admin-orgs-table">
            <thead>
              <tr>
                <th>Activity</th>
                <th>Entity</th>
                <th>Organisation</th>
                <th>When</th>
              </tr>
            </thead>
            <tbody>
              {pageEntries.map((entry) => (
                <tr key={entry.id}>
                  <td data-label="Activity">
                    <span className="admin-orgs-directory-identity">
                      <span className="admin-audit-avatar" aria-hidden="true">
                        {actorInitial(entry.actorName)}
                      </span>
                      <span className="admin-orgs-directory-copy">
                        <span className="admin-orgs-name">{formatAction(entry.action)}</span>
                        <span className="admin-orgs-directory-subdomain">{entry.actorName}</span>
                      </span>
                    </span>
                  </td>
                  <td data-label="Entity">
                    <span className="admin-templates-facet">{formatEntity(entry.entityType)}</span>
                  </td>
                  <td data-label="Organisation">
                    {entry.organizationId ? (
                      <Link
                        href={`/admin/organisations/${entry.organizationId}`}
                        className="admin-users-org-link"
                      >
                        {entry.organizationName}
                      </Link>
                    ) : (
                      entry.organizationName
                    )}
                  </td>
                  <td data-label="When">
                    <time
                      className="admin-audit-time"
                      dateTime={entry.createdAt}
                      title={formatExactTime(entry.createdAt)}
                    >
                      {formatRelativeTime(entry.createdAt)}
                    </time>
                  </td>
                </tr>
              ))}
              {visibleEntries.length === 0 ? (
                <tr>
                  <td colSpan={4} className="admin-table-empty">
                    No audit log entries match your filters.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="admin-orgs-footer forms-pagination">
          <span>
            {visibleEntries.length} {visibleEntries.length === 1 ? 'entry' : 'entries'} · Page{' '}
            {currentPage} of {totalPages}
          </span>
          <div className="forms-pagination-controls">
            <button
              type="button"
              className="forms-pagination-button"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={currentPage <= 1}
              aria-label="Previous page"
            >
              ‹
            </button>
            <button
              type="button"
              className="forms-pagination-button"
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
              disabled={currentPage >= totalPages}
              aria-label="Next page"
            >
              ›
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
