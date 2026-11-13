'use client';

import { useMemo, useState } from 'react';
import { useMounted } from '@/components/local-date';
import { formatDateTime, formatShortDate } from '@/lib/format-date';
import styles from './org-logs.module.css';

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
   * varies per action and is shown in the expanded event details. */
  metadata: Record<string, unknown>;
  createdAt: string;
  actorName: string;
}

const PAGE_SIZE = 25;

const ACTION_LABELS: Record<string, string> = {
  'admin.organization_create': 'Created organisation',
  'admin.organization_update': 'Updated organisation',
  'admin.user_2fa_reset': 'Reset two-factor authentication',
  'admin.user_invite': 'Invited platform user',
  'admin.user_invite_revoke': 'Revoked platform invite',
  'admin.user_password_reset': 'Reset user password',
  'form.autosave': 'Saved form changes',
  'form.create': 'Created form',
  'form.delete': 'Deleted form',
  'form.duplicate': 'Duplicated form',
  'form.filename_prefix_field_update': 'Updated filename prefix',
  'form.notification_settings_update': 'Updated notification settings',
  'form.pdf_filename_template_update': 'Updated PDF filename',
  'form.publish': 'Published form',
  'form.rename': 'Renamed form',
  'form.transfer': 'Transferred form',
  'form.unpublish': 'Took form offline',
  'organization.details_update': 'Updated organisation details',
  'organization.logo_remove': 'Removed organisation logo',
  'organization.logo_update': 'Updated organisation logo',
  'organization.plan_change': 'Changed organisation plan',
  'platform_admin.joined_organization': 'Joined organisation',
  'platform_admin.left_organization': 'Left organisation',
  'prefill.delete': 'Deleted prefill',
  'prefill.resend': 'Resent prefill',
  'prefill.send_back': 'Returned prefill for changes',
  'submission.delete': 'Deleted response',
  'submission.edit': 'Edited response',
  'submission.export_pdf': 'Exported response PDF',
  'submission.promote': 'Moved prefill to responses',
  'submission.status_update': 'Updated response status',
  'submission.submit': 'Submitted response',
  'submission.unpromote': 'Returned response to prefills',
  'user.2fa_disabled': 'Disabled two-factor authentication',
  'user.2fa_enabled': 'Enabled two-factor authentication',
  'user.invite': 'Invited team member',
  'user.invite_accept': 'Accepted team invite',
  'user.invite_revoke': 'Revoked team invite',
  'user.password_change': 'Changed password',
  'user.password_reset': 'Reset password',
  'user.profile_update': 'Updated profile',
  'user.remove': 'Removed team member',
  'user.update': 'Updated team member',
};

const CATEGORY_LABELS: Record<string, string> = {
  all: 'All activity',
  form: 'Forms',
  submission: 'Responses',
  prefill: 'Prefills',
  people: 'People',
  organization: 'Organisation',
  admin: 'Administration',
};

const CATEGORY_ORDER = ['form', 'submission', 'prefill', 'people', 'organization', 'admin'];

const ENTITY_TYPE_LABELS: Record<string, string> = {
  form: 'Form',
  form_version: 'Form version',
  submission: 'Response',
  submission_file: 'Response file',
  prefill: 'Prefill',
  user: 'User',
  user_invite: 'Invite',
  organization: 'Organisation',
  billing_event: 'Billing event',
  review: 'Review',
};

function humanise(value: string): string {
  const words = value
    .split(/[._-]+/)
    .filter(Boolean)
    .join(' ')
    .replace(/\borganization\b/gi, 'organisation')
    .replace(/\b2fa\b/gi, 'two-factor')
    .replace(/\bpdf\b/gi, 'PDF');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function entityTypeLabel(entityType: string): string {
  return ENTITY_TYPE_LABELS[entityType] ?? humanise(entityType);
}

/** Groups lower-level audit prefixes into the product areas people recognise in the UI. */
function actionCategory(action: string): string {
  const prefix = action.split('.')[0] ?? action;
  if (prefix === 'user') return 'people';
  if (prefix === 'platform_admin') return 'admin';
  return prefix;
}

function categoryLabel(category: string): string {
  return CATEGORY_LABELS[category] ?? humanise(category);
}

function formatAction(action: string): string {
  if (ACTION_LABELS[action]) return ACTION_LABELS[action];
  return humanise(action.split('.').pop() ?? action);
}

function actorInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'S';
  const first = parts[0]?.[0] ?? 'S';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return `${first}${last}`.toUpperCase();
}

function formatTime(iso: string, local: boolean): string {
  return formatDateTime(iso, local).split(', ').at(-1) ?? formatDateTime(iso, local);
}

function formatMetadataValue(value: unknown): { text: string; structured: boolean } {
  if (value === null || typeof value === 'undefined') return { text: 'None', structured: false };
  if (typeof value === 'boolean') return { text: value ? 'Yes' : 'No', structured: false };
  if (typeof value === 'object') {
    return { text: JSON.stringify(value, null, 2), structured: true };
  }
  return { text: String(value), structured: false };
}

function SearchIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="11" cy="11" r="6.75" stroke="currentColor" strokeWidth="1.8" />
      <path d="m16 16 4.25 4.25" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="m5 5 10 10M15 5 5 15"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function HistoryIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4.4 8.2A8.2 8.2 0 1 1 4 13"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M4.4 3.9v4.3h4.3M12 7.7v4.7l3.1 1.8"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="m5.5 7.5 4.5 4.5 4.5-4.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ArrowIcon({ direction }: { direction: 'left' | 'right' }) {
  const transform = direction === 'left' ? 'rotate(180 10 10)' : undefined;
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
      style={{ transform }}
    >
      <path
        d="M4 10h11M11 6l4 4-4 4"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ActivityIcon({ category }: { category: string }) {
  if (category === 'form') {
    return (
      <svg width="21" height="21" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M7 3.5h7l3.5 3.5v13.5H7z"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinejoin="round"
        />
        <path
          d="M14 3.5V7h3.5M9.5 11h5M9.5 14.5h5"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  if (category === 'submission') {
    return (
      <svg width="21" height="21" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect
          x="5"
          y="3.5"
          width="14"
          height="17"
          rx="2.5"
          stroke="currentColor"
          strokeWidth="1.7"
        />
        <path
          d="m8.5 12 2.1 2.1 4.9-5M8.5 17h7"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  if (category === 'people') {
    return (
      <svg width="21" height="21" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="8" r="3.25" stroke="currentColor" strokeWidth="1.7" />
        <path
          d="M5.5 19.5c.7-3.4 3.1-5.2 6.5-5.2s5.8 1.8 6.5 5.2"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  if (category === 'prefill') {
    return (
      <svg width="21" height="21" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="m3.5 11.4 16.8-7-5.7 15.2-3.4-6.2z"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinejoin="round"
        />
        <path d="m11.2 13.4 9.1-9" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    );
  }
  if (category === 'organization' || category === 'admin') {
    return (
      <svg width="21" height="21" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M4.5 20.5h15M6.5 20.5V8.5h11v12M9 8.5v-4h6v4M9.5 12h.01M14.5 12h.01M9.5 16h.01M14.5 16h.01"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  return <HistoryIcon size={21} />;
}

export function OrgLogsClient({ initialEntries }: { initialEntries: OrgLogRow[] }) {
  const mounted = useMounted();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const entry of initialEntries) {
      const key = actionCategory(entry.action);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return [
      { key: 'all', label: categoryLabel('all'), count: initialEntries.length },
      ...Array.from(counts.entries())
        .sort(([a], [b]) => {
          const aIndex = CATEGORY_ORDER.indexOf(a);
          const bIndex = CATEGORY_ORDER.indexOf(b);
          if (aIndex === -1 && bIndex === -1) return a.localeCompare(b);
          if (aIndex === -1) return 1;
          if (bIndex === -1) return -1;
          return aIndex - bIndex;
        })
        .map(([key, count]) => ({ key, label: categoryLabel(key), count })),
    ];
  }, [initialEntries]);

  const contributorCount = useMemo(
    () => new Set(initialEntries.map((entry) => entry.actorName)).size,
    [initialEntries],
  );

  const visibleEntries = useMemo(() => {
    const term = search.trim().toLowerCase();
    return initialEntries.filter((entry) => {
      if (category !== 'all' && actionCategory(entry.action) !== category) return false;
      if (!term) return true;
      return (
        entry.action.toLowerCase().includes(term) ||
        formatAction(entry.action).toLowerCase().includes(term) ||
        entry.actorName.toLowerCase().includes(term) ||
        entry.entityType.toLowerCase().includes(term) ||
        entityTypeLabel(entry.entityType).toLowerCase().includes(term) ||
        (entry.target ?? '').toLowerCase().includes(term)
      );
    });
  }, [initialEntries, search, category]);

  const totalPages = Math.max(1, Math.ceil(visibleEntries.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageEntries = visibleEntries.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const dayGroups = useMemo(() => {
    const groups = new Map<string, OrgLogRow[]>();
    for (const entry of pageEntries) {
      const day = formatShortDate(entry.createdAt, mounted);
      const items = groups.get(day) ?? [];
      items.push(entry);
      groups.set(day, items);
    }
    return Array.from(groups.entries());
  }, [pageEntries, mounted]);

  const hasFilters = category !== 'all' || search.trim().length > 0;
  const rangeStart = visibleEntries.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(currentPage * PAGE_SIZE, visibleEntries.length);

  function clearFilters() {
    setSearch('');
    setCategory('all');
    setPage(1);
    setExpandedId(null);
  }

  return (
    <main className={styles.page}>
      <header className={styles.hero}>
        <div className={styles.heroTopline}>
          <div className={styles.heroHeading}>
            <span className={styles.heroIcon} aria-hidden="true">
              <HistoryIcon size={24} />
            </span>
            <div>
              <p className={styles.heroKicker}>Organisation history</p>
              <h1 className={styles.heroTitle}>Activity log</h1>
              <p className={styles.heroLead}>
                Track changes to forms, responses, people and workspace settings in one place.
              </p>
            </div>
          </div>
          <span className={styles.heroBadge}>
            {initialEntries.length >= 200
              ? 'Latest 200 events'
              : `${initialEntries.length} recorded ${initialEntries.length === 1 ? 'event' : 'events'}`}
          </span>
        </div>

        <ul className={styles.heroStats} aria-label="Activity snapshot">
          <li className={styles.heroStat}>
            <strong>{initialEntries.length}</strong>
            <span>Recent events</span>
          </li>
          <li className={styles.heroStat}>
            <strong>{contributorCount}</strong>
            <span>{contributorCount === 1 ? 'Contributor' : 'Contributors'}</span>
          </li>
          <li className={styles.heroStat}>
            <strong>{Math.max(0, categories.length - 1)}</strong>
            <span>Activity areas</span>
          </li>
        </ul>
      </header>

      {initialEntries.length === 0 ? (
        <section className={styles.emptyState}>
          <span className={styles.emptyIcon} aria-hidden="true">
            <HistoryIcon size={26} />
          </span>
          <h2>No activity yet</h2>
          <p>Changes made across your organisation will appear here as they happen.</p>
        </section>
      ) : (
        <section className={styles.panel} aria-labelledby="recent-activity-title">
          <div className={styles.panelToolbar}>
            <div className={styles.panelHeading}>
              <p className={styles.panelKicker}>Latest events</p>
              <h2 id="recent-activity-title">Recent activity</h2>
              <p>Newest first, across the activity currently retained in this view.</p>
            </div>

            <label className={styles.search}>
              <span className={styles.searchIcon} aria-hidden="true">
                <SearchIcon />
              </span>
              <input
                type="search"
                placeholder="Search activity, people or items…"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                  setExpandedId(null);
                }}
                aria-label="Search activity log"
              />
              {search ? (
                <button
                  type="button"
                  className={styles.searchClear}
                  onClick={() => {
                    setSearch('');
                    setPage(1);
                  }}
                  aria-label="Clear search"
                >
                  <CloseIcon />
                </button>
              ) : null}
            </label>
          </div>

          <div className={styles.filterScroller}>
            <fieldset className={styles.filters}>
              <legend className={styles.visuallyHidden}>Filter activity by area</legend>
              {categories.map((item) => {
                const isActive = category === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    className={`${styles.filterChip}${isActive ? ` ${styles.filterChipActive}` : ''}`}
                    aria-pressed={isActive}
                    onClick={() => {
                      setCategory(item.key);
                      setPage(1);
                      setExpandedId(null);
                    }}
                  >
                    <span
                      className={styles.filterDot}
                      data-category={item.key}
                      aria-hidden="true"
                    />
                    <span>{item.label}</span>
                    <span className={styles.filterCount}>{item.count}</span>
                  </button>
                );
              })}
            </fieldset>
          </div>

          <div className={styles.resultsBar} aria-live="polite">
            <span>
              {visibleEntries.length === initialEntries.length
                ? `${visibleEntries.length} ${visibleEntries.length === 1 ? 'event' : 'events'}`
                : `${visibleEntries.length} of ${initialEntries.length} events`}
            </span>
            {hasFilters ? (
              <button type="button" onClick={clearFilters}>
                Clear filters
              </button>
            ) : null}
          </div>

          {visibleEntries.length === 0 ? (
            <div className={styles.noResults}>
              <span className={styles.emptyIcon} aria-hidden="true">
                <SearchIcon />
              </span>
              <h3>No matching activity</h3>
              <p>Try a different search or clear your filters to see every event.</p>
              <button type="button" className={styles.clearButton} onClick={clearFilters}>
                Clear filters
              </button>
            </div>
          ) : (
            <div className={styles.activityArea}>
              {dayGroups.map(([day, entries]) => (
                <section key={day} className={styles.dayGroup} aria-label={day}>
                  <h3>{day}</h3>
                  <ol className={styles.activityList}>
                    {entries.map((entry) => {
                      const entryCategory = actionCategory(entry.action);
                      const actionLabel = formatAction(entry.action);
                      const isExpanded = expandedId === entry.id;
                      const detailsId = `log-details-${entry.id}`;
                      const metadata = Object.entries(entry.metadata);
                      return (
                        <li
                          key={entry.id}
                          className={`${styles.activityItem}${isExpanded ? ` ${styles.activityItemExpanded}` : ''}`}
                        >
                          <div className={styles.activityRow}>
                            <span
                              className={styles.activityIcon}
                              data-category={entryCategory}
                              aria-hidden="true"
                            >
                              <ActivityIcon category={entryCategory} />
                            </span>

                            <div className={styles.activityCopy}>
                              <div className={styles.activityTitleRow}>
                                <span className={styles.activityTitle}>{actionLabel}</span>
                                <span className={styles.entityChip}>
                                  {entityTypeLabel(entry.entityType)}
                                </span>
                              </div>
                              <p className={styles.activitySupport}>
                                <span
                                  className={entry.target ? styles.target : styles.targetMissing}
                                >
                                  {entry.target ?? 'No item label available'}
                                </span>
                                <span className={styles.supportDivider} aria-hidden="true">
                                  ·
                                </span>
                                <span>by {entry.actorName}</span>
                              </p>
                            </div>

                            <time
                              className={styles.activityTime}
                              dateTime={entry.createdAt}
                              title={formatDateTime(entry.createdAt, mounted)}
                            >
                              {formatTime(entry.createdAt, mounted)}
                            </time>

                            <button
                              type="button"
                              className={styles.expandButton}
                              aria-expanded={isExpanded}
                              aria-controls={detailsId}
                              aria-label={`${isExpanded ? 'Hide' : 'Show'} details for ${actionLabel}`}
                              onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                            >
                              <span
                                className={isExpanded ? styles.chevronExpanded : styles.chevron}
                              >
                                <ChevronIcon />
                              </span>
                            </button>
                          </div>

                          {isExpanded ? (
                            <div id={detailsId} className={styles.details}>
                              <div className={styles.detailsHeader}>
                                <div>
                                  <p className={styles.detailsKicker}>Event details</p>
                                  <h4>{actionLabel}</h4>
                                </div>
                                <code className={styles.actionKey}>{entry.action}</code>
                              </div>

                              <dl className={styles.detailsGrid}>
                                <div>
                                  <dt>Actor</dt>
                                  <dd className={styles.actorDetail}>
                                    <span aria-hidden="true">{actorInitials(entry.actorName)}</span>
                                    {entry.actorName}
                                  </dd>
                                </div>
                                <div>
                                  <dt>Item</dt>
                                  <dd>{entry.target ?? 'Not available'}</dd>
                                </div>
                                <div>
                                  <dt>Occurred</dt>
                                  <dd>
                                    <time dateTime={entry.createdAt}>
                                      {formatDateTime(entry.createdAt, mounted)}
                                    </time>
                                  </dd>
                                </div>
                                <div>
                                  <dt>Entity type</dt>
                                  <dd>{entityTypeLabel(entry.entityType)}</dd>
                                </div>
                                <div className={styles.entityId}>
                                  <dt>Entity ID</dt>
                                  <dd>
                                    <code>{entry.entityId}</code>
                                  </dd>
                                </div>
                              </dl>

                              <div className={styles.metadataSection}>
                                <h5>Additional metadata</h5>
                                {metadata.length > 0 ? (
                                  <dl className={styles.metadataGrid}>
                                    {metadata.map(([key, value]) => {
                                      const formatted = formatMetadataValue(value);
                                      return (
                                        <div key={key}>
                                          <dt>{humanise(key)}</dt>
                                          <dd>
                                            {formatted.structured ? (
                                              <pre>{formatted.text}</pre>
                                            ) : (
                                              formatted.text
                                            )}
                                          </dd>
                                        </div>
                                      );
                                    })}
                                  </dl>
                                ) : (
                                  <p className={styles.noMetadata}>
                                    No additional metadata was recorded for this event.
                                  </p>
                                )}
                              </div>
                            </div>
                          ) : null}
                        </li>
                      );
                    })}
                  </ol>
                </section>
              ))}
            </div>
          )}

          {visibleEntries.length > 0 ? (
            <footer className={styles.pagination}>
              <span>
                Showing {rangeStart}–{rangeEnd} of {visibleEntries.length}
              </span>
              <div className={styles.paginationControls}>
                <button
                  type="button"
                  onClick={() => {
                    setPage((current) => Math.max(1, current - 1));
                    setExpandedId(null);
                  }}
                  disabled={currentPage <= 1}
                >
                  <ArrowIcon direction="left" />
                  <span>Previous</span>
                </button>
                <span className={styles.pageCount}>
                  {currentPage} / {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setPage((current) => Math.min(totalPages, current + 1));
                    setExpandedId(null);
                  }}
                  disabled={currentPage >= totalPages}
                >
                  <span>Next</span>
                  <ArrowIcon direction="right" />
                </button>
              </div>
            </footer>
          ) : null}
        </section>
      )}
    </main>
  );
}
