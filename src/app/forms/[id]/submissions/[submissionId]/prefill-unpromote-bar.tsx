'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useToast } from '@/components/toast';
import './prefill-unpromote-bar.css';

/** Shown on a response that was promoted from a prefill, for a limited time: moves it back to
 * the Prefills tab (held for review again) in case it was promoted by mistake. */
export function PrefillUnpromoteBar({
  formId,
  submissionId,
  undoUntil,
}: {
  formId: string;
  submissionId: string;
  undoUntil: string;
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
  // Worked out after mount so the server and browser clocks can't disagree during hydration.
  const [daysLeft, setDaysLeft] = useState<number | null>(null);
  useEffect(() => {
    const ms = new Date(undoUntil).getTime() - Date.now();
    setDaysLeft(Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000))));
  }, [undoUntil]);

  return (
    <div className="pub">
      <span className="pub-icon" aria-hidden="true">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path
            d="M7.5 5 4 8.5 7.5 12M4 8.5h7.5a4.5 4.5 0 0 1 0 9H9"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <div className="pub-text">
        <div className="pub-title-row">
          <strong className="pub-title">Promoted from a prefill</strong>
          <span className="pub-pill">
            {daysLeft === null
              ? `Undo until ${until}`
              : daysLeft <= 1
                ? 'Last day to undo'
                : `${daysLeft} days left to undo`}
          </span>
        </div>
        <p className="pub-copy">
          Promoted by mistake? Move it back to Prefills any time before {until}. After that it stays
          in Responses for good.
        </p>
      </div>
      <button type="button" className="pub-action" onClick={undo} disabled={busy}>
        <svg width="15" height="15" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path
            d="M7.5 5 4 8.5 7.5 12M4 8.5h7.5a4.5 4.5 0 0 1 0 9H9"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        {busy ? 'Moving…' : 'Move back to Prefills'}
      </button>
    </div>
  );
}
