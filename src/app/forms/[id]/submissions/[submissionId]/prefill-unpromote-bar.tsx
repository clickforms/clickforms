'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useToast } from '@/components/toast';
import '@/app/forms/[id]/prefills/prefills.css';

/** Shown on a response that was promoted from a prefill, for a limited time: moves it back to
 * the Prefills tab (held for review again) in case it was promoted by mistake. */
export function PrefillUnpromoteBar({
  formId,
  submissionId,
  undoUntil,
  days,
}: {
  formId: string;
  submissionId: string;
  undoUntil: string;
  days: number;
}) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function undo() {
    setBusy(true);
    try {
      const res = await fetch(`/api/forms/${formId}/submissions/${submissionId}/unpromote`, {
        method: 'POST',
      });
      const data: { error?: string } = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? 'Something went wrong.');
        return;
      }
      toast.success('Moved back to Prefills');
      router.push(`/forms/${formId}/prefills`);
      router.refresh();
    } catch {
      toast.error('Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  const until = new Date(undoUntil).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
  });

  return (
    <div className="pfr-bar">
      <div className="pfr-text">
        <strong>Promoted from a prefill</strong>
        <span>
          Promoted by mistake? You can move it back to Prefills until {until} ({days} days after
          promoting). After that it stays in Responses.
        </span>
      </div>
      <div className="pfr-actions">
        <button type="button" className="pf-btn pf-btn--ghost" onClick={undo} disabled={busy}>
          {busy ? 'Moving…' : 'Move back to Prefills'}
        </button>
      </div>
    </div>
  );
}
