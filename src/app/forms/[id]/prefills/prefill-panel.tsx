'use client';

import { useEffect, useMemo, useState } from 'react';
import { SubmissionPreviewModal } from '@/app/forms/[id]/submissions/submission-preview-modal';
import { useMounted } from '@/components/local-date';
import { useToast } from '@/components/toast';
import { formatDateTime } from '@/lib/format-date';
import type { CompareRow } from '@/lib/forms/prefill-compare';

interface CompareData {
  rows: CompareRow[];
  responseId: string | null;
  held: boolean;
  returnedAt: string | null;
}

const TAG: Record<string, string> = {
  changed: 'Changed',
  added: 'Added by client',
  cleared: 'Cleared by client',
};

const isDiff = (row: CompareRow) => ['changed', 'added', 'cleared'].includes(row.status);

/**
 * Inline panel shown when a prefill row with a returned response is expanded: what changed, the
 * response itself (opened in the same form-styled view used on the Responses page), and the
 * promote / discard actions.
 */
export function PrefillPanel({
  formId,
  prefillId,
  onChanged,
}: {
  formId: string;
  prefillId: string;
  /** Called after promote/discard so the list refreshes. */
  onChanged: () => void;
}) {
  const toast = useToast();
  const mounted = useMounted();
  const [data, setData] = useState<CompareData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [onlyChanges, setOnlyChanges] = useState(true);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<'promote' | 'discard' | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/forms/${formId}/prefills/${prefillId}/compare`)
      .then(async (res) => {
        if (!res.ok) throw new Error('failed');
        return (await res.json()) as CompareData;
      })
      .then((json) => {
        if (!cancelled) setData(json);
      })
      .catch(() => {
        if (!cancelled) setError('Could not load this response.');
      });
    return () => {
      cancelled = true;
    };
  }, [formId, prefillId]);

  const changed = useMemo(() => (data ? data.rows.filter(isDiff) : []), [data]);
  const shown = data ? (onlyChanges && changed.length > 0 ? changed : data.rows) : [];

  async function act(action: 'promote' | 'discard') {
    setBusy(true);
    try {
      const res = await fetch(`/api/forms/${formId}/prefills/${prefillId}/${action}`, {
        method: 'POST',
      });
      const json: { error?: string } = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(json.error ?? 'Something went wrong.');
        return;
      }
      toast.success(action === 'promote' ? 'Promoted to Responses' : 'Response discarded');
      setConfirm(null);
      onChanged();
    } catch {
      toast.error('Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  if (error) return <div className="pfp pfp--msg">{error}</div>;
  if (!data) return <div className="pfp pfp--msg">Loading…</div>;

  return (
    <div className="pfp">
      <div className="pfp-bar">
        <div className="pfp-summary">
          <strong>
            {changed.length === 0
              ? 'No changes — returned exactly as sent'
              : `${changed.length} ${changed.length === 1 ? 'field' : 'fields'} changed by the client`}
          </strong>
          <span>
            {data.returnedAt ? `Returned ${formatDateTime(data.returnedAt, mounted)}` : null}
            {data.held ? ' · Not in Responses yet' : ' · In Responses'}
          </span>
        </div>
        <div className="pfp-actions">
          {data.responseId ? (
            <button
              type="button"
              className="pf-btn pf-btn--ghost pf-btn--sm"
              onClick={() => setPreviewId(data.responseId)}
            >
              Open response
            </button>
          ) : null}
          {data.held ? (
            <>
              <button
                type="button"
                className="pf-btn pf-btn--ghost pf-btn--sm pf-btn--dangerline"
                onClick={() => setConfirm('discard')}
              >
                Discard
              </button>
              <button
                type="button"
                className="pf-btn pf-btn--primary pf-btn--sm"
                onClick={() => setConfirm('promote')}
              >
                Promote to response
              </button>
            </>
          ) : data.responseId ? (
            <a
              className="pf-btn pf-btn--ghost pf-btn--sm"
              href={`/forms/${formId}/submissions/${data.responseId}`}
            >
              View in Responses
            </a>
          ) : null}
        </div>
      </div>

      {data.rows.length > 0 ? (
        <>
          {changed.length > 0 ? (
            <label className="pfd-switch pfp-switch">
              <input
                type="checkbox"
                checked={onlyChanges}
                onChange={(event) => setOnlyChanges(event.target.checked)}
              />
              <span aria-hidden="true" />
              Changes only
            </label>
          ) : null}
          <table className="pf-table pfd-table pfp-table">
            <thead>
              <tr>
                <th>Field</th>
                <th>Sent</th>
                <th>Returned</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((row) => (
                <tr key={row.fieldId} className={isDiff(row) ? 'pfd-row--changed' : undefined}>
                  <td className="pfd-field">
                    {row.label}
                    {isDiff(row) ? <em>{TAG[row.status]}</em> : null}
                  </td>
                  <td className={row.original ? undefined : 'pf-muted'}>{row.original ?? '—'}</td>
                  <td className={row.returned ? (isDiff(row) ? 'pfd-new' : undefined) : 'pf-muted'}>
                    {row.returned ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : null}

      <SubmissionPreviewModal
        open={previewId !== null}
        formId={formId}
        submissionId={previewId}
        onClose={() => setPreviewId(null)}
      />

      {confirm ? (
        // biome-ignore lint/a11y/noStaticElementInteractions: backdrop click-to-dismiss
        <div
          className="pf-overlay"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !busy) setConfirm(null);
          }}
        >
          <div className="pf-dialog" role="dialog" aria-modal="true">
            <h2>{confirm === 'promote' ? 'Promote to response?' : 'Discard this response?'}</h2>
            <p>
              {confirm === 'promote'
                ? 'It will appear in Responses and count as a submitted response. The prefill and its original answers stay here.'
                : 'The returned response is deleted for good. The prefill stays, and the link can be used again.'}
            </p>
            <div className="pf-dialog-actions">
              <button
                type="button"
                className="pf-btn pf-btn--ghost"
                disabled={busy}
                onClick={() => setConfirm(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className={`pf-btn ${confirm === 'promote' ? 'pf-btn--primary' : 'pf-btn--danger'}`}
                disabled={busy}
                onClick={() => void act(confirm)}
              >
                {busy ? 'Working…' : confirm === 'promote' ? 'Promote' : 'Discard'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
