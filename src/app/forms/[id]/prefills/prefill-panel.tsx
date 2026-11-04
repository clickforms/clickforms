'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useMounted } from '@/components/local-date';
import { formatDateTime } from '@/lib/format-date';

interface ResponseItem {
  id: string;
  held: boolean;
  submittedAt: string | null;
  label: string | null;
}

/**
 * What an expanded prefill row shows: the responses that came back through it, as a list. Each
 * one opens the full review page (the same form-styled page used on Responses), where it can be
 * checked against what was sent, edited, and promoted.
 */
export function PrefillPanel({ formId, prefillId }: { formId: string; prefillId: string }) {
  const mounted = useMounted();
  const [items, setItems] = useState<ResponseItem[] | null>(null);
  const [changedCount, setChangedCount] = useState(0);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/forms/${formId}/prefills/${prefillId}/compare`)
      .then(async (res) => {
        if (!res.ok) throw new Error('failed');
        return (await res.json()) as { responses: ResponseItem[]; changedCount: number };
      })
      .then((json) => {
        if (cancelled) return;
        setItems(json.responses);
        setChangedCount(json.changedCount);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [formId, prefillId]);

  if (error) return <div className="pfp pfp--msg">Could not load the responses.</div>;
  if (!items) return <div className="pfp pfp--msg">Loading…</div>;
  if (items.length === 0) return <div className="pfp pfp--msg">No responses yet.</div>;

  return (
    <div className="pfp">
      <ul className="pfp-list">
        {items.map((item) => (
          <li key={item.id}>
            <Link href={`/forms/${formId}/submissions/${item.id}`} className="pfp-item">
              <span className="pfp-item-main">
                <strong>{item.label ?? 'Response'}</strong>
                <small>
                  {item.submittedAt ? formatDateTime(item.submittedAt, mounted) : 'Returned'}
                </small>
              </span>
              {item.held && changedCount > 0 ? (
                <span className="pfp-changed">{changedCount} changed</span>
              ) : null}
              <span className={`pfp-state ${item.held ? 'pfp-state--review' : 'pfp-state--done'}`}>
                {item.held ? 'Needs review' : 'In Responses'}
              </span>
              <svg
                className="pfp-item-go"
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="m6 3.5 4.5 4.5L6 12.5" />
              </svg>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
