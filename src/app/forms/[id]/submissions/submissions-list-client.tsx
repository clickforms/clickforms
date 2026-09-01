'use client';

import type { SubmissionStatus } from '@prisma/client';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { DeleteSubmissionModal } from '@/app/forms/[id]/submissions/delete-submission-modal';
import {
  SubmissionsDateRangePicker,
  type SubmissionsDateRangeValue,
} from '@/app/forms/[id]/submissions/submissions-date-range-picker';
import { useToast } from '@/components/toast';
import { readApiError } from '@/lib/error-message';
import { parseIsoDate } from '@/lib/forms/date-value';

interface SubmissionSummary {
  id: string;
  status: SubmissionStatus;
  submittedAt: string | null;
  ipAddress: string | null;
  createdAt: string;
}

const PAGE_SIZE = 10;

function ResponsesEmptyIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
      <path
        d="M4 4.5h14a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-6.5L8 19v-3.5H4a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M7 9h8M7 12h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M8 5v3.2l2.2 1.3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M1.5 8s2.2-4.5 6.5-4.5S14.5 8 14.5 8s-2.2 4.5-6.5 4.5S1.5 8 1.5 8Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <circle cx="8" cy="8" r="1.75" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M3 4.5h10M6 4.5V3.2c0-.5.4-.9.9-.9h2.2c.5 0 .9.4.9.9v1.3M5.5 7v4.8M10.5 7v4.8M3.8 4.5l.5 8.2c.05.6.55 1 1.1 1h5.2c.55 0 1.05-.4 1.1-1l.5-8.2"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
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
    <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path
        d="M2.5 6.3 5 8.8l4.5-5.1"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CrossIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path
        d="M2.8 2.8l6.4 6.4M9.2 2.8l-6.4 6.4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ChevronLeftIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path
        d="M8.5 3 4 7l4.5 4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path
        d="M5.5 3 10 7l-4.5 4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const SUBMISSION_STATUS_BADGE: Record<
  SubmissionStatus,
  {
    label: string;
    className: string;
    accentClassName: string;
    icon: (() => React.JSX.Element) | null;
  }
> = {
  in_progress: {
    label: 'In progress',
    className: 'badge--neutral',
    accentClassName: 'submissions-row--neutral',
    icon: ClockIcon,
  },
  submitted: {
    label: 'Submitted',
    className: 'badge--success',
    accentClassName: 'submissions-row--success',
    icon: CheckIcon,
  },
  approved: {
    label: 'Approved',
    className: 'badge--approved',
    accentClassName: 'submissions-row--approved',
    icon: CheckIcon,
  },
  rejected: {
    label: 'Rejected',
    className: 'badge--error',
    accentClassName: 'submissions-row--danger',
    icon: CrossIcon,
  },
};

// Client wrapper around the responses table so a `canDelete` org member can remove a
// submission from here without opening it first — mirrors FormsListClient's optimistic
// delete flow (DeleteFormModal + fetch DELETE + toast, revert on failure). Also owns the
// search/date-range filtering and pagination, all client-side since a single form's
// response list is small enough not to warrant server-side paging.
export function SubmissionsListClient({
  formId,
  initialSubmissions,
  canDelete,
}: {
  formId: string;
  initialSubmissions: SubmissionSummary[];
  canDelete: boolean;
}) {
  const [submissions, setSubmissions] = useState(initialSubmissions);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [search, setSearch] = useState('');
  const [dateRange, setDateRange] = useState<SubmissionsDateRangeValue>({ from: null, to: null });
  const [page, setPage] = useState(1);
  const toast = useToast();

  // Jump back to page 1 whenever a filter changes — otherwise narrowing the results could
  // strand the view on a now out-of-range page.
  // biome-ignore lint/correctness/useExhaustiveDependencies: deps intentionally trigger a reset even though the effect body doesn't read them
  useEffect(() => {
    setPage(1);
  }, [search, dateRange.from, dateRange.to]);

  async function handleDeleteConfirm() {
    if (!deletingId) return;
    const id = deletingId;

    setIsDeleting(true);
    const previous = submissions;
    setSubmissions((current) => current.filter((entry) => entry.id !== id));

    try {
      const response = await fetch(`/api/forms/${formId}/submissions/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error(await readApiError(response, 'Failed to delete response'));
      }
      toast.success('Response deleted');
      setDeletingId(null);
    } catch (err) {
      setSubmissions(previous);
      toast.error(err instanceof Error ? err.message : 'Failed to delete response');
    } finally {
      setIsDeleting(false);
    }
  }

  const filteredSubmissions = useMemo(() => {
    const term = search.trim().toLowerCase();
    const fromDate = parseIsoDate(dateRange.from ?? undefined);
    const toDate = parseIsoDate(dateRange.to ?? undefined);
    if (toDate) toDate.setHours(23, 59, 59, 999);

    return submissions.filter((submission) => {
      if (fromDate || toDate) {
        const reference = new Date(submission.submittedAt ?? submission.createdAt);
        if (fromDate && reference < fromDate) return false;
        if (toDate && reference > toDate) return false;
      }

      if (!term) return true;
      const badge = SUBMISSION_STATUS_BADGE[submission.status];
      const haystack = [
        submission.submittedAt
          ? new Date(submission.submittedAt).toLocaleString('en-AU')
          : 'in progress',
        badge.label,
        submission.ipAddress ?? '',
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [submissions, search, dateRange]);

  const totalPages = Math.max(1, Math.ceil(filteredSubmissions.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageSubmissions = filteredSubmissions.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  if (submissions.length === 0) {
    return (
      <div className="card submissions-empty-state">
        <span className="submissions-empty-icon" aria-hidden="true">
          <ResponsesEmptyIcon />
        </span>
        <p className="submissions-empty-title">No responses yet</p>
        <p className="submissions-empty-hint">
          Once someone submits this form, their response will show up here.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="card admin-table-card">
        <div className="submissions-toolbar">
          <div className="submissions-toolbar-filters">
            <label className="submissions-search">
              <span className="submissions-search-icon">
                <SearchIcon />
              </span>
              <input
                type="text"
                placeholder="Search responses"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                aria-label="Search responses"
              />
            </label>
            <SubmissionsDateRangePicker value={dateRange} onChange={setDateRange} />
          </div>
          <span className="submissions-count-badge">
            {filteredSubmissions.length} of {submissions.length}{' '}
            {submissions.length === 1 ? 'response' : 'responses'}
          </span>
        </div>

        <div className="admin-table-scroll">
          <table className="admin-table submissions-table">
            <thead>
              <tr>
                <th>Submitted at</th>
                <th>Status</th>
                <th>IP address</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {pageSubmissions.map((submission) => {
                const badge = SUBMISSION_STATUS_BADGE[submission.status];
                const StatusIcon = badge.icon;
                return (
                  <tr key={submission.id} className={badge.accentClassName}>
                    <td data-label="Submitted at">
                      <span className="submissions-timestamp">
                        <ClockIcon />
                        {submission.submittedAt
                          ? new Date(submission.submittedAt).toLocaleString('en-AU')
                          : 'In progress'}
                      </span>
                    </td>
                    <td data-label="Status">
                      <span className={`badge ${badge.className}`}>
                        {StatusIcon ? <StatusIcon /> : null}
                        {badge.label}
                      </span>
                    </td>
                    <td data-label="IP address" className="submissions-ip">
                      {submission.ipAddress ?? '—'}
                    </td>
                    <td data-label="Actions">
                      <div className="submissions-row-actions">
                        <Link
                          className="submissions-icon-button"
                          href={`/forms/${formId}/submissions/${submission.id}`}
                          aria-label="View response"
                          title="View response"
                        >
                          <EyeIcon />
                        </Link>
                        {canDelete ? (
                          <button
                            type="button"
                            className="submissions-icon-button submissions-icon-button--danger"
                            onClick={() => setDeletingId(submission.id)}
                            aria-label="Delete response"
                            title="Delete response"
                          >
                            <TrashIcon />
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {pageSubmissions.length === 0 ? (
                <tr>
                  <td colSpan={4} className="admin-table-empty">
                    No responses match your search or date filter.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="submissions-pagination">
          <span>
            Page {currentPage} of {totalPages}
          </span>
          <div className="submissions-pagination-controls">
            <button
              type="button"
              className="submissions-pagination-button"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={currentPage <= 1}
              aria-label="Previous page"
            >
              <ChevronLeftIcon />
            </button>
            <button
              type="button"
              className="submissions-pagination-button"
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
              disabled={currentPage >= totalPages}
              aria-label="Next page"
            >
              <ChevronRightIcon />
            </button>
          </div>
        </div>
      </div>

      {canDelete ? (
        <DeleteSubmissionModal
          open={deletingId !== null}
          isDeleting={isDeleting}
          onClose={() => !isDeleting && setDeletingId(null)}
          onConfirm={() => void handleDeleteConfirm()}
        />
      ) : null}
    </>
  );
}
