'use client';

import type { SubmissionStatus } from '@prisma/client';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { DeleteSubmissionModal } from '@/app/forms/[id]/submissions/delete-submission-modal';
import { SubmissionPreviewModal } from '@/app/forms/[id]/submissions/submission-preview-modal';
import { SubmissionStatusMenu } from '@/app/forms/[id]/submissions/submission-status-menu';
import {
  SubmissionsDateRangePicker,
  type SubmissionsDateRangeValue,
} from '@/app/forms/[id]/submissions/submissions-date-range-picker';
import {
  readSubmissionFilters,
  writeSubmissionFilters,
} from '@/app/forms/[id]/submissions/submissions-list-filters';
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

function formatResponseTimestamp(iso: string): string {
  const date = new Date(iso);
  const day = date.toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const time = date
    .toLocaleTimeString('en-AU', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
    .toUpperCase();
  return `${day} · ${time}`;
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

function SearchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden="true">
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

// Mirrors parseFilenameFromContentDisposition in
// submissions/[submissionId]/submission-answers-editor.tsx — not exported from there, and
// small/pure enough that duplicating it here beats wiring up a shared module for one
// regex. See that file's comment for why the Content-Disposition header (not the response
// body's mime type) is what names the downloaded file.
function parseFilenameFromContentDisposition(header: string | null): string | null {
  if (!header) return null;
  const match = /filename="?([^";]+)"?/i.exec(header);
  return match?.[1]?.trim() || null;
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
    // Matches the "Submitted" badge on the org-wide Files page (forms/files/page.tsx) —
    // neutral gray rather than green, since "submitted" just means "awaiting review",
    // not a positive/finalised outcome (that's 'approved', which keeps badge--success).
    className: 'badge--neutral',
    accentClassName: 'submissions-row--neutral',
    // No checkmark here — a check reads as "done"/"approved", which is misleading for a
    // status that just means "awaiting review". 'approved' (Finalised) keeps the check.
    icon: null,
  },
  // 'approved'/'rejected' were reserved in the enum but never set anywhere until the
  // Responses table's status dropdown (submission-status-menu.tsx) — reused here under
  // the "Finalised"/"Rejected" review-state labels rather than adding new enum values.
  approved: {
    label: 'Finalised',
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
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [dateRange, setDateRange] = useState<SubmissionsDateRangeValue>({
    from: null,
    to: null,
  });
  const [page, setPage] = useState(1);
  const [filtersReady, setFiltersReady] = useState(false);
  const toast = useToast();
  const router = useRouter();
  const skipPageReset = useRef(true);

  // Restore after mount so SSR/hydration doesn't wipe sessionStorage with empty defaults.
  useEffect(() => {
    skipPageReset.current = true;
    const stored = readSubmissionFilters(formId);
    setSearch(stored.search);
    setDateRange({ from: stored.from, to: stored.to });
    setPage(stored.page);
    setFiltersReady(true);
  }, [formId]);

  // Jump back to page 1 whenever a filter changes — skip the restore pass so opening a
  // response and coming back keeps the stored page.
  useEffect(() => {
    if (!filtersReady) return;
    if (skipPageReset.current) {
      skipPageReset.current = false;
      return;
    }
    setPage(1);
  }, [filtersReady, search, dateRange.from, dateRange.to]);

  useEffect(() => {
    if (!filtersReady) return;
    writeSubmissionFilters(formId, {
      search,
      from: dateRange.from,
      to: dateRange.to,
      page,
    });
  }, [filtersReady, formId, search, dateRange.from, dateRange.to, page]);

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

  // Applied instantly, no confirmation step — matches how archive/publish toggle
  // elsewhere in the app (FormsListClient), and freely reversible between all three
  // states so there's no destructive edge here the way there is with delete.
  async function handleStatusChange(id: string, status: SubmissionStatus) {
    const previous = submissions;
    setSubmissions((current) =>
      current.map((entry) => (entry.id === id ? { ...entry, status } : entry)),
    );

    try {
      const response = await fetch(`/api/forms/${formId}/submissions/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) {
        throw new Error(await readApiError(response, 'Failed to update status'));
      }
      toast.success(`Marked as ${SUBMISSION_STATUS_BADGE[status].label}`);
    } catch (err) {
      setSubmissions(previous);
      toast.error(err instanceof Error ? err.message : 'Failed to update status');
    }
  }

  // Same fetch-as-blob approach as the submission detail page's export button (see its
  // comment on handleExportPdf) — checks res.ok before ever touching the browser's
  // download UI, so a failed export shows a toast instead of downloading a JSON error
  // body disguised as a PDF.
  async function handleExportPdf(id: string) {
    setExportingId(id);
    try {
      const res = await fetch(`/api/forms/${formId}/submissions/${id}/export/pdf`);
      if (!res.ok) {
        throw new Error(await readApiError(res, 'Failed to export PDF'));
      }

      const blob = await res.blob();
      const filename =
        parseFilenameFromContentDisposition(res.headers.get('Content-Disposition')) ??
        'submission.pdf';

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to export PDF');
    } finally {
      setExportingId(null);
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
        submission.submittedAt ? formatResponseTimestamp(submission.submittedAt) : 'in progress',
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
                const detailHref = `/forms/${formId}/submissions/${submission.id}`;
                return (
                  // biome-ignore lint/a11y/useSemanticElements: must stay a <tr> for correct table semantics — role="button" + tabIndex + onKeyDown supply the missing button affordance instead of nesting a real <button> around table cells
                  <tr
                    key={submission.id}
                    className={`${badge.accentClassName} submissions-row--clickable`}
                    role="button"
                    tabIndex={0}
                    onClick={() => router.push(detailHref)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        router.push(detailHref);
                      }
                    }}
                  >
                    <td data-label="Submitted at">
                      <span className="submissions-timestamp">
                        <ClockIcon />
                        {submission.submittedAt
                          ? formatResponseTimestamp(submission.submittedAt)
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
                      {/* Row itself already navigates on click/Enter — stop these
                          row-level handlers from also firing when the click/keypress
                          originated on one of the actions below (e.g. the preview eye
                          button should open the modal, not also navigate away; Delete
                          shouldn't also navigate before its confirm modal opens). Not
                          itself interactive — just a bubbling firewall around the real
                          button controls it wraps. */}
                      {/* biome-ignore lint/a11y/noStaticElementInteractions: onClick/onKeyDown here only stopPropagation to shield the row's own handlers — the actual interactive elements are the buttons inside */}
                      <div
                        className="submissions-row-actions"
                        onClick={(event) => event.stopPropagation()}
                        onKeyDown={(event) => event.stopPropagation()}
                      >
                        <button
                          type="button"
                          className="submissions-icon-button"
                          onClick={() => setPreviewId(submission.id)}
                          aria-label="Preview response"
                          title="Preview response"
                        >
                          <EyeIcon />
                        </button>
                        {canDelete ? (
                          <SubmissionStatusMenu
                            status={submission.status}
                            onStatusChange={(status) => handleStatusChange(submission.id, status)}
                            onDelete={() => setDeletingId(submission.id)}
                            onExportPdf={() => handleExportPdf(submission.id)}
                            isExporting={exportingId === submission.id}
                          />
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

      <SubmissionPreviewModal
        open={previewId !== null}
        formId={formId}
        submissionId={previewId}
        onClose={() => setPreviewId(null)}
      />
    </>
  );
}
