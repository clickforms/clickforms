'use client';

import type { SubmissionStatus } from '@prisma/client';
import Link from 'next/link';
import { useState } from 'react';
import { DeleteSubmissionModal } from '@/app/forms/[id]/submissions/delete-submission-modal';
import { useToast } from '@/components/toast';
import { readApiError } from '@/lib/error-message';

interface SubmissionSummary {
  id: string;
  status: SubmissionStatus;
  submittedAt: string | null;
  ipAddress: string | null;
  createdAt: string;
}

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

const SUBMISSION_STATUS_BADGE: Record<SubmissionStatus, { label: string; className: string }> = {
  in_progress: { label: 'In progress', className: 'badge--neutral' },
  submitted: { label: 'Submitted', className: 'badge--success' },
  approved: { label: 'Approved', className: 'badge--success' },
  rejected: { label: 'Rejected', className: 'badge--error' },
};

// Client wrapper around the responses table so a `canDelete` org member can remove a
// submission from here without opening it first — mirrors FormsListClient's optimistic
// delete flow (DeleteFormModal + fetch DELETE + toast, revert on failure).
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
  const toast = useToast();

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
        <div className="admin-table-scroll">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Submitted at</th>
                <th>Status</th>
                <th>IP address</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {submissions.map((submission) => {
                const badge = SUBMISSION_STATUS_BADGE[submission.status];
                return (
                  <tr key={submission.id}>
                    <td data-label="Submitted at">
                      {submission.submittedAt
                        ? new Date(submission.submittedAt).toLocaleString('en-AU')
                        : 'In progress'}
                    </td>
                    <td data-label="Status">
                      <span className={`badge ${badge.className}`}>{badge.label}</span>
                    </td>
                    <td data-label="IP address">{submission.ipAddress ?? '—'}</td>
                    <td data-label="Actions">
                      <div className="submissions-row-actions">
                        <Link
                          className="button button--ghost button--small"
                          href={`/forms/${formId}/submissions/${submission.id}`}
                        >
                          View
                        </Link>
                        {canDelete ? (
                          <button
                            type="button"
                            className="button button--ghost button--small button--ghost-danger"
                            onClick={() => setDeletingId(submission.id)}
                          >
                            Delete
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
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
