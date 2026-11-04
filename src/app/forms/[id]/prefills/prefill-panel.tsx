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
      <p className="pfp-heading">
        {items.length === 1 ? 'Response' : `${items.length} responses`}
        {changedCount > 0 ? (
          <span>
            {' '}
            · {changedCount} {changedCount === 1 ? 'field' : 'fields'} changed by the client
          </span>
        ) : null}
      </p>
      <ul className="pfp-list">
        {items.map((item) => (
          <li key={item.id}>
            <Link href={`/forms/${formId}/submissions/${item.id}`} className="pfp-item">
              <span className="pfp-item-main">
                <strong>{item.label ?? 'Response'}</strong>
                <small>
                  {item.submittedAt
                    ? `Returned ${formatDateTime(item.submittedAt, mounted)}`
                    : 'Returned'}
                </small>
              </span>
              <span
                className={`pf-status ${item.held ? 'pf-status--review' : 'pf-status--completed'}`}
              >
                <i aria-hidden="true" />
                {item.held ? 'Needs review' : 'In Responses'}
              </span>
              <span className="pfp-item-go" aria-hidden="true">
                {item.held ? 'Review' : 'Open'} →
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
