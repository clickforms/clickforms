'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useToast } from '@/components/toast';
import '@/app/forms/[id]/prefills/prefills.css';

/** Shown on the review page of a response that came back through a prefill and is still held:
 * promote it into Responses, or discard it. Edits made on this page are saved as usual first. */
export function PrefillReviewBar({
  formId,
  prefillId,
  canAct,
  recipient,
  submissionId,
  sentBack,
}: {
  formId: string;
  prefillId: string;
  canAct: boolean;
  recipient: string | null;
  submissionId: string;
  sentBack: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [confirm, setConfirm] = useState<'promote' | 'discard' | 'sendback' | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  async function sendBack() {
    setBusy(true);
    try {
      const res = await fetch(`/api/forms/${formId}/prefills/${prefillId}/send-back`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ submissionId, note: note.trim() || undefined }),
      });
      const data: { error?: string; emailed?: boolean } = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? 'Something went wrong.');
        return;
      }
      toast.success(data.emailed ? 'Sent back for correction' : 'Correction link created');
      setConfirm(null);
      setNote('');
      router.push(`/forms/${formId}/prefills`);
    } catch {
      toast.error('Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  async function act(action: 'promote' | 'discard') {
    setBusy(true);
    try {
      const res = await fetch(`/api/forms/${formId}/prefills/${prefillId}/${action}`, {
        method: 'POST',
      });
      const data: { error?: string } = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? 'Something went wrong.');
        return;
      }
      if (action === 'promote') {
        toast.success('Promoted to Responses');
        setConfirm(null);
        router.refresh();
      } else {
        toast.success('Response discarded');
        router.push(`/forms/${formId}/prefills`);
      }
    } catch {
      toast.error('Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="pfr-bar">
        <span className={`pfr-icon${sentBack ? ' pfr-icon--back' : ''}`} aria-hidden="true">
          <svg
            aria-hidden="true"
            width="20"
            height="20"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {sentBack ? (
              <path d="M8 5 4 9l4 4M4 9h8a4 4 0 0 1 4 4v1" />
            ) : (
              <path d="M10 6v4.5l3 1.5M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z" />
            )}
          </svg>
        </span>
        <div className="pfr-text">
          <strong>{sentBack ? 'Sent back for correction' : 'Needs review'}</strong>
          <span>
            {sentBack
              ? `${recipient ?? 'They'} ${recipient ? 'has' : 'have'} been asked to correct it. Their new answers will appear under the same prefill.`
              : `${recipient ? `From ${recipient}. ` : ''}Not in Responses until you promote it.`}
          </span>
        </div>
        <div className="pfr-actions">
          {canAct ? (
            <>
              <details className="pfr-more">
                <summary className="pf-icon-btn" aria-label="More options" title="More">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <circle cx="3.5" cy="8" r="1.3" />
                    <circle cx="8" cy="8" r="1.3" />
                    <circle cx="12.5" cy="8" r="1.3" />
                  </svg>
                </summary>
                <div className="pfr-more-menu">
                  <button
                    type="button"
                    className="pfr-more-item pfr-more-item--danger"
                    onClick={() => setConfirm('discard')}
                  >
                    Discard response
                  </button>
                </div>
              </details>
              {sentBack ? null : (
                <button
                  type="button"
                  className="pf-btn pf-btn--ghost pf-btn--sm"
                  onClick={() => setConfirm('sendback')}
                >
                  Send back
                </button>
              )}
              <button
                type="button"
                className="pf-btn pf-btn--primary pf-btn--sm"
                onClick={() => setConfirm('promote')}
              >
                Promote
              </button>
            </>
          ) : null}
        </div>
      </div>

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
            <h2>
              {confirm === 'promote'
                ? 'Promote to response?'
                : confirm === 'sendback'
                  ? 'Send back for correction?'
                  : 'Discard this response?'}
            </h2>
            <p>
              {confirm === 'promote'
                ? 'It will appear in Responses and count as a submitted response. The prefill and its original answers stay in the Prefills tab.'
                : confirm === 'sendback'
                  ? 'They get a new link with their answers filled in so they can fix them. It stays under this prefill, and this response is kept as a record.'
                  : 'The returned response is deleted for good. The prefill stays, and the link can be used again.'}
            </p>
            {confirm === 'sendback' ? (
              <textarea
                className="pf-note"
                rows={3}
                maxLength={1000}
                placeholder="What should they fix? (optional)"
                value={note}
                onChange={(event) => setNote(event.target.value)}
              />
            ) : null}
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
                className={`pf-btn ${confirm === 'discard' ? 'pf-btn--danger' : 'pf-btn--primary'}`}
                disabled={busy}
                onClick={() => (confirm === 'sendback' ? void sendBack() : void act(confirm))}
              >
                {busy
                  ? 'Working…'
                  : confirm === 'promote'
                    ? 'Promote'
                    : confirm === 'sendback'
                      ? 'Send back'
                      : 'Discard'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
