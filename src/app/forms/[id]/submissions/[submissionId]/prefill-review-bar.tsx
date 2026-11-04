'use client';

import Link from 'next/link';
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
}: {
  formId: string;
  prefillId: string;
  canAct: boolean;
  recipient: string | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const [confirm, setConfirm] = useState<'promote' | 'discard' | null>(null);
  const [busy, setBusy] = useState(false);

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
        <div className="pfr-text">
          <strong>Waiting for review</strong>
          <span>
            {recipient
              ? `Returned by ${recipient} through a prefill. `
              : 'Returned through a prefill. '}
            It isn&apos;t in Responses yet.
          </span>
        </div>
        <div className="pfr-actions">
          <Link href={`/forms/${formId}/prefills`} className="pf-btn pf-btn--ghost pf-btn--sm">
            Back to Prefills
          </Link>
          {canAct ? (
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
            <h2>{confirm === 'promote' ? 'Promote to response?' : 'Discard this response?'}</h2>
            <p>
              {confirm === 'promote'
                ? 'It will appear in Responses and count as a submitted response. The prefill and its original answers stay in the Prefills tab.'
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
    </>
  );
}
