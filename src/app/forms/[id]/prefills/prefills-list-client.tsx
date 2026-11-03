'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { useToast } from '@/components/toast';
import './prefills.css';

type Status = 'draft' | 'sent' | 'opened' | 'started' | 'completed' | 'expired';

interface PrefillItem {
  id: string;
  recipientEmail: string | null;
  recipientName: string | null;
  url: string;
  /** Where "Continue" opens the builder for a draft. */
  continueHref: string;
  status: Status;
  sentAt: string;
  createdBy: string | null;
  responses: number;
}

const STATUS_LABEL: Record<Status, string> = {
  draft: 'Draft',
  sent: 'Sent',
  opened: 'Opened',
  started: 'In progress',
  completed: 'Completed',
  expired: 'Expired',
};

const FILTERS: { key: 'all' | Status; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'draft', label: 'Drafts' },
  { key: 'sent', label: 'Sent' },
  { key: 'opened', label: 'Opened' },
  { key: 'started', label: 'In progress' },
  { key: 'completed', label: 'Completed' },
  { key: 'expired', label: 'Expired' },
];

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Hand-built (no Intl, UTC) so server and browser render identical text.
function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

function initials(item: PrefillItem): string {
  const source = item.recipientName || item.recipientEmail || '';
  const parts = source.split(/[\s@._-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '?') + (parts[1]?.[0] ?? '')).toUpperCase();
}

function Icon({ d }: { d: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d={d}
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function PrefillsListClient({
  formId,
  slug,
  isLive,
  initialPrefills,
}: {
  formId: string;
  slug: string;
  isLive: boolean;
  initialPrefills: PrefillItem[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | Status>('all');
  const [search, setSearch] = useState('');
  const [toDelete, setToDelete] = useState<PrefillItem | null>(null);

  const counts = useMemo(() => {
    const map = new Map<string, number>([['all', initialPrefills.length]]);
    for (const item of initialPrefills) map.set(item.status, (map.get(item.status) ?? 0) + 1);
    return map;
  }, [initialPrefills]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return initialPrefills.filter((item) => {
      if (filter !== 'all' && item.status !== filter) return false;
      if (!term) return true;
      return `${item.recipientName ?? ''} ${item.recipientEmail ?? ''}`
        .toLowerCase()
        .includes(term);
    });
  }, [initialPrefills, filter, search]);

  async function resend(item: PrefillItem) {
    setBusyId(item.id);
    try {
      const res = await fetch(`/api/forms/${formId}/prefills/${item.id}/resend`, {
        method: 'POST',
      });
      const data: { error?: string } = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? 'Could not resend the email.');
        return;
      }
      toast.success(`Email re-sent to ${item.recipientEmail}`);
      router.refresh();
    } catch {
      toast.error('Could not resend the email.');
    } finally {
      setBusyId(null);
    }
  }

  async function confirmDelete() {
    if (!toDelete) return;
    const item = toDelete;
    setBusyId(item.id);
    try {
      const res = await fetch(`/api/forms/${formId}/prefills/${item.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data: { error?: string } = await res.json().catch(() => ({}));
        toast.error(data.error ?? 'Could not delete the prefill.');
        return;
      }
      toast.success('Prefill deleted');
      setToDelete(null);
      router.refresh();
    } catch {
      toast.error('Could not delete the prefill.');
    } finally {
      setBusyId(null);
    }
  }

  function copy(url: string) {
    void navigator.clipboard.writeText(url).then(
      () => toast.success('Link copied'),
      () => toast.error('Could not copy the link'),
    );
  }

  const newHref = `/f/${slug}/prefill`;

  if (initialPrefills.length === 0) {
    return (
      <div className="pf-empty">
        <span className="pf-empty-icon" aria-hidden="true">
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
            <rect
              x="5"
              y="4"
              width="18"
              height="20"
              rx="3"
              stroke="currentColor"
              strokeWidth="1.6"
            />
            <path
              d="M9 10h10M9 14h10M9 18h6"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
        </span>
        <h2>No prefills yet</h2>
        <p>
          Fill in the answers you already know, then email the form or share a link. Responses that
          come back are marked as prefilled.
        </p>
        {isLive ? (
          <a className="pf-btn pf-btn--primary" href={newHref}>
            New prefill
          </a>
        ) : (
          <p className="pf-muted">Publish the form to start sending prefilled links.</p>
        )}
      </div>
    );
  }

  return (
    <div className="pf-card">
      <div className="pf-toolbar">
        <div className="pf-filters" role="tablist" aria-label="Filter by status">
          {FILTERS.filter((f) => f.key === 'all' || (counts.get(f.key) ?? 0) > 0).map((f) => (
            <button
              key={f.key}
              type="button"
              role="tab"
              aria-selected={filter === f.key}
              className="pf-filter"
              onClick={() => setFilter(f.key)}
            >
              {f.label}
              <span className="pf-filter-count">{counts.get(f.key) ?? 0}</span>
            </button>
          ))}
        </div>
        <div className="pf-toolbar-right">
          <label className="pf-search">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.5" />
              <path
                d="m10.5 10.5 3 3"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
            <input
              type="text"
              placeholder="Search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              aria-label="Search prefills"
            />
          </label>
          {isLive ? (
            <a className="pf-btn pf-btn--primary" href={newHref}>
              + New prefill
            </a>
          ) : null}
        </div>
      </div>

      <div className="pf-scroll">
        <table className="pf-table">
          <thead>
            <tr>
              <th>Recipient</th>
              <th>Status</th>
              <th>Date</th>
              <th>Created by</th>
              <th aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {visible.map((item) => (
              <tr key={item.id}>
                <td>
                  <div className="pf-person">
                    <span
                      className={`pf-avatar${item.status === 'draft' ? ' pf-avatar--draft' : ''}`}
                    >
                      {initials(item)}
                    </span>
                    <span className="pf-person-text">
                      <strong>
                        {item.recipientName ||
                          item.recipientEmail ||
                          (item.status === 'draft' ? 'Untitled draft' : 'Shared link')}
                      </strong>
                      <small>
                        {item.recipientEmail
                          ? item.recipientName
                            ? item.recipientEmail
                            : 'Emailed'
                          : item.status === 'draft'
                            ? 'Not sent yet'
                            : 'Shared as a link'}
                      </small>
                    </span>
                  </div>
                </td>
                <td>
                  <span className={`pf-status pf-status--${item.status}`}>
                    <i aria-hidden="true" />
                    {STATUS_LABEL[item.status]}
                  </span>
                </td>
                <td className="pf-muted">{formatDate(item.sentAt)}</td>
                <td className="pf-muted">{item.createdBy ?? '—'}</td>
                <td>
                  <div className="pf-actions">
                    {item.status === 'draft' ? (
                      <a className="pf-btn pf-btn--primary pf-btn--sm" href={item.continueHref}>
                        Continue
                      </a>
                    ) : item.status !== 'expired' ? (
                      <button
                        type="button"
                        className="pf-btn pf-btn--ghost pf-btn--sm"
                        onClick={() => copy(item.url)}
                      >
                        Copy link
                      </button>
                    ) : null}
                    {item.recipientEmail &&
                    item.status !== 'draft' &&
                    item.status !== 'expired' &&
                    item.status !== 'completed' ? (
                      <button
                        type="button"
                        className="pf-icon-btn"
                        title="Resend email"
                        aria-label="Resend email"
                        disabled={busyId === item.id}
                        onClick={() => void resend(item)}
                      >
                        <Icon d="M2.5 4.5h11v7h-11zM2.5 5l5.5 4 5.5-4" />
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="pf-icon-btn pf-icon-btn--danger"
                      title="Delete"
                      aria-label="Delete prefill"
                      disabled={busyId === item.id}
                      onClick={() => setToDelete(item)}
                    >
                      <Icon d="M3.5 4.5h9M6.5 4.5V3h3v1.5M5 4.5l.5 8h5l.5-8" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {visible.length === 0 ? (
              <tr>
                <td colSpan={5} className="pf-none">
                  No prefills match.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {toDelete ? (
        // biome-ignore lint/a11y/noStaticElementInteractions: backdrop click-to-dismiss; buttons cover keyboard users
        <div
          className="pf-overlay"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && busyId === null) setToDelete(null);
          }}
        >
          <div className="pf-dialog" role="dialog" aria-modal="true" aria-labelledby="pf-del-title">
            <h2 id="pf-del-title">Delete this prefill?</h2>
            <p>
              {toDelete.responses > 0
                ? 'Its link will stop working. Responses already submitted through it are kept.'
                : toDelete.status === 'draft'
                  ? 'This draft will be removed.'
                  : 'Its link will stop working.'}
            </p>
            <div className="pf-dialog-actions">
              <button
                type="button"
                className="pf-btn pf-btn--ghost"
                disabled={busyId !== null}
                onClick={() => setToDelete(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="pf-btn pf-btn--danger"
                disabled={busyId !== null}
                onClick={() => void confirmDelete()}
              >
                {busyId ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
