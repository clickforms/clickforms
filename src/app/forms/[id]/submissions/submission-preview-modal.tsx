'use client';

import { useEffect } from 'react';

interface SubmissionPreviewModalProps {
  open: boolean;
  formSlug: string;
  submissionId: string | null;
  onClose: () => void;
}

/**
 * Read-only "what would print" preview of a response, opened from the eye icon on the
 * Responses table (row click still goes to the full detail/edit page — see
 * submissions-list-client.tsx). Reuses the same route Puppeteer navigates to for the
 * actual PDF export (src/app/f/[slug]/submissions/[submissionId]/preview) in an iframe,
 * so this always matches the exported PDF's layout exactly rather than drifting from a
 * second hand-built preview. `print=1` suppresses that route's "Submission preview"
 * banner the same way the PDF-export header does, since the modal chrome already makes
 * clear this is a preview.
 */
export function SubmissionPreviewModal({
  open,
  formSlug,
  submissionId,
  onClose,
}: SubmissionPreviewModalProps) {
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open || !submissionId) return null;

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: click-outside-to-dismiss backdrop; Escape key and a Close button are also wired up
    <div className="modal-overlay" onMouseDown={onClose}>
      <div
        className="modal-card modal-card--preview"
        role="dialog"
        aria-modal="true"
        aria-label="Response preview"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <h2 className="modal-title">Response preview</h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="submission-preview-frame-wrap">
          <iframe
            key={submissionId}
            src={`/f/${formSlug}/submissions/${submissionId}/preview?print=1`}
            title="Response preview"
            className="submission-preview-frame"
          />
        </div>
      </div>
    </div>
  );
}
