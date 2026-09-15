'use client';

import { Fragment, useMemo, useState } from 'react';

export interface OrgLogRow {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  /** Human-readable label for the entity acted on (form name, response's form + date,
   * an email address) — see resolveAuditLogTargets. Null if the entity was since
   * deleted, or its type isn't one that resolver looks up. */
  target: string | null;
  /** Raw metadata captured at logAudit()-call time (see src/lib/audit.ts) — shape
   * varies per action, shown pretty-printed when a row is expanded. */
  metadata: Record<string, unknown>;
  createdAt: string;
  actorName: string;
}

const PAGE_SIZE = 25;

const ENTITY_TYPE_LABELS: Record<string, string> = {
  form: 'Form',
  form_version: 'Form version',
  submission: 'Response',
  user: 'User',
  user_invite: 'Invite',
  organization: 'Organisation',
};

function entityTypeLabel(entityType: string): string {
  return ENTITY_TYPE_LABELS[entityType] ?? entityType;
}

function SearchIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="7" cy="7" r="4.6" stroke="currentColor" strokeWidth="1.4" />
      <path d="M13 13l-2.5-2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

/** "form.publish" -> category "form". Categories are derived from whatever action
 * strings actually exist rather than a hardcoded list, since every route that calls
 * logAudit() can introduce a new prefix (see src/lib/audit.ts) — same approach as the
 * platform-wide /admin/audit-log page. */
function actionCategory(action: string): string {
  return action.split('.')[0] ?? action;
}

function formatAction(action: string): string {
  const verb = action.split('.').slice(1).join(' ') || action;
  const words = verb.split('_').join(' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function OrgLogsClient({ initialEntries }: { initialEntries: OrgLogRow[] }) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);

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
        entry.actorName.toLowerCase().includes(term) ||
        entry.entityType.toLowerCase().includes(term) ||
        (entry.target ?? '').toLowerCase().includes(term)
      );
    });
  }, [initialEntries, search, category]);

  const totalPages = Math.max(1, Math.ceil(visibleEntries.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageEntries = visibleEntries.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <div>
      <div className="users-page-header">
        <div>
          <h1 className="users-page-title">Logs</h1>
          <p className="users-page-subtitle">
            Every logged activity in your organisation, most recent first (last{' '}
            {initialEntries.length}).
          </p>
        </div>
      </div>

      {initialEntries.length === 0 ? (
        <div className="card empty-state">
          <p>No activity logged yet.</p>
        </div>
      ) : (
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
                placeholder="Search by action or person…"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                aria-label="Search logs"
              />
            </label>
          </div>
          <div className="admin-table-scroll">
            <table className="admin-table forms-table">
              <thead>
                <tr>
                  <th>Action</th>
                  <th>Entity</th>
                  <th>Details</th>
                  <th>Actor</th>
                  <th>When</th>
                </tr>
              </thead>
              <tbody>
                {pageEntries.map((entry) => {
                  const isExpanded = expandedId === entry.id;
                  const hasMetadata = Object.keys(entry.metadata).length > 0;
                  return (
                    <Fragment key={entry.id}>
                      <tr
                        className={hasMetadata ? 'forms-row--clickable' : undefined}
                        role={hasMetadata ? 'button' : undefined}
                        tabIndex={hasMetadata ? 0 : undefined}
                        onClick={() => hasMetadata && setExpandedId(isExpanded ? null : entry.id)}
                        onKeyDown={(event) => {
                          if (!hasMetadata) return;
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            setExpandedId(isExpanded ? null : entry.id);
                          }
                        }}
                      >
                        <td data-label="Action">{formatAction(entry.action)}</td>
                        <td data-label="Entity">{entityTypeLabel(entry.entityType)}</td>
                        <td data-label="Details" className="admin-log-target">
                          {entry.target ?? <span className="admin-log-target--empty">—</span>}
                        </td>
                        <td data-label="Actor">{entry.actorName}</td>
                        <td data-label="When">
                          {new Date(entry.createdAt).toLocaleString('en-AU')}
                        </td>
                      </tr>
                      {isExpanded ? (
                        <tr className="admin-log-metadata-row">
                          <td colSpan={5}>
                            <div className="admin-log-metadata">
                              <p className="admin-log-metadata-id">Entity ID: {entry.entityId}</p>
                              <pre>{JSON.stringify(entry.metadata, null, 2)}</pre>
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
                {visibleEntries.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="admin-table-empty">
                      No activity matches your filters.
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
      )}
    </div>
  );
}
