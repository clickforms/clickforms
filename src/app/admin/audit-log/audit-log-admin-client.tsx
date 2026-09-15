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

/** "admin.organization_create" -> category "admin". Categories are derived from
 * whatever action strings actually exist rather than a hardcoded list, since every
 * route that calls logAudit() can introduce a new prefix (see src/lib/audit.ts). */
function actionCategory(action: string): string {
  return action.split('.')[0] ?? action;
}

function formatAction(action: string): string {
  const verb = action.split('.').slice(1).join(' ') || action;
  const words = verb.split('_').join(' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
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
        .map(([key, count]) => ({ key, label: key.charAt(0).toUpperCase() + key.slice(1), count })),
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
    <div>
      <div className="forms-list-header">
        <div>
          <h1 className="settings-page-title">Audit log</h1>
          <p className="settings-page-lead">
            Every logged admin and organisation action, most recent first (last{' '}
            {initialEntries.length}).
          </p>
        </div>
      </div>

      <div className="card admin-table-card">
        <div className="admin-filter-chip-row">
          {categories.map((cat) => (
            <button
              key={cat.key}
              type="button"
              className={`admin-filter-chip${category === cat.key ? ' admin-filter-chip--active' : ''}`}
              onClick={() => {
                setCategory(cat.key);
                setPage(1);
              }}
            >
              {cat.label} <span className="admin-filter-chip-count">{cat.count}</span>
            </button>
          ))}
        </div>
        <div className="table-search-row">
          <label className="forms-search">
            <span className="forms-search-icon">
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
          <table className="admin-table forms-table">
            <thead>
              <tr>
                <th>Action</th>
                <th>Entity</th>
                <th>Organisation</th>
                <th>Actor</th>
                <th>When</th>
              </tr>
            </thead>
            <tbody>
              {pageEntries.map((entry) => (
                <tr key={entry.id}>
                  <td data-label="Action">{formatAction(entry.action)}</td>
                  <td data-label="Entity">{entry.entityType}</td>
                  <td data-label="Organisation">
                    {entry.organizationId ? (
                      <Link
                        href={`/admin/organisations/${entry.organizationId}`}
                        className="admin-table-name-link"
                      >
                        {entry.organizationName}
                      </Link>
                    ) : (
                      entry.organizationName
                    )}
                  </td>
                  <td data-label="Actor">{entry.actorName}</td>
                  <td data-label="When">{new Date(entry.createdAt).toLocaleString('en-AU')}</td>
                </tr>
              ))}
              {visibleEntries.length === 0 ? (
                <tr>
                  <td colSpan={5} className="admin-table-empty">
                    No audit log entries match your filters.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="forms-pagination">
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
