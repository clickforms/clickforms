'use client';

import { useEffect, useState } from 'react';
import { SubmissionFormExportDocument } from '@/components/submission-export/submission-form-export-document';
import { readApiError } from '@/lib/error-message';
import type { FormAnswers } from '@/lib/forms/conditional-logic';
import type { ResolvedSubmissionFile } from '@/lib/forms/format-submission-answer';
import type { FormSchema } from '@/lib/forms/schema';
import { SUBMISSION_EXPORT_STYLES } from '@/lib/forms/submission-export-styles';

interface SubmissionPreviewPayload {
  formName: string;
  schema: FormSchema;
  answers: FormAnswers;
  assets: {
    fieldImages: Record<string, string>;
    submissionFiles: Record<string, string>;
  };
  filesByFieldId: Record<string, ResolvedSubmissionFile[]>;
}

interface SubmissionPreviewModalProps {
  open: boolean;
  formId: string;
  submissionId: string | null;
  onClose: () => void;
}

function scopedExportStyles(): string {
  return SUBMISSION_EXPORT_STYLES.replace(/\bbody\b/g, '.submission-preview-live').replace(
    '* { box-sizing: border-box; }',
    '.submission-preview-live, .submission-preview-live * { box-sizing: border-box; }',
  );
}

/**
 * Read-only "what would print" preview of a response, opened from the eye icon on the
 * Responses table (row click still goes to the full detail/edit page — see
 * submissions-list-client.tsx). Renders the same SubmissionFormExportDocument the PDF
 * export uses, loaded via GET /api/forms/[id]/submissions/[submissionId]/preview.
 * Used to iframe /f/[slug]/submissions/[id]/preview, but that public-form URL is
 * X-Frame-Options-blocked from the /forms workspace on production (the iframe was
 * refused for https://clickforms.com.au/).
 */
export function SubmissionPreviewModal({
  open,
  formId,
  submissionId,
  onClose,
}: SubmissionPreviewModalProps) {
  const [payload, setPayload] = useState<SubmissionPreviewPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!open || !submissionId) {
      setPayload(null);
      setError(null);
      return;
    }

    let cancelled = false;
    setPayload(null);
    setError(null);

    void (async () => {
      try {
        const res = await fetch(`/api/forms/${formId}/submissions/${submissionId}/preview`);
        if (!res.ok) {
          throw new Error(await readApiError(res, 'Could not load this response preview'));
        }
        const data = (await res.json()) as SubmissionPreviewPayload;
        if (!cancelled) setPayload(data);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not load this response preview');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, formId, submissionId]);

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
          {error ? (
            <p className="submission-preview-status" role="alert">
              {error}
            </p>
          ) : payload ? (
            <div className="submission-preview-live">
              <style>{scopedExportStyles()}</style>
              <SubmissionFormExportDocument
                formName={payload.formName}
                schema={payload.schema}
                answers={payload.answers}
                assets={payload.assets}
                resolveFiles={(fieldId) => payload.filesByFieldId[fieldId] ?? []}
              />
            </div>
          ) : (
            <p className="submission-preview-status">Loading preview…</p>
          )}
        </div>
      </div>
    </div>
  );
}
