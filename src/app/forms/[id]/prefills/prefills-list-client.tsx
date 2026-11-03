'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useToast } from '@/components/toast';
import './prefills.css';

type Status = 'draft' | 'sent' | 'opened' | 'started' | 'completed' | 'expired';

interface PrefillItem {
  id: string;
  recipientEmail: string | null;
  url: string;
  /** Where "Continue" opens the builder for a draft. */
  continueHref: string;
  recipientName: string | null;
  status: Status;
  sentAt: string;
  createdBy: string | null;
  responses: number;
}

const STATUS_LABEL: Record<Status, string> = {
  draft: 'Draft',
  sent: 'Sent',
  opened: 'Opened',
  started: 'In progress',
  completed: 'Completed',
  expired: 'Expired',
};

export function PrefillsListClient({
  formId,
  slug,
  isLive,
  initialPrefills,
}: {
  formId: string;
  slug: string;
  isLive: boolean;
  initialPrefills: PrefillItem[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [busyId, setBusyId] = useState<string | null>(null);

  async function resend(item: PrefillItem) {
    setBusyId(item.id);
    try {
      const res = await fetch(`/api/forms/${formId}/prefills/${item.id}/resend`, {
        method: 'POST',
      });
      const data: { error?: string } = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? 'Could not resend the email.');
        return;
      }
      toast.success(`Email re-sent to ${item.recipientEmail}`);
      router.refresh();
    } catch {
      toast.error('Could not resend the email.');
    } finally {
      setBusyId(null);
    }
  }

  async function remove(item: PrefillItem) {
    const extra =
      item.responses > 0
        ? ' Responses already submitted through it are kept.'
        : ' The link will stop working.';
    if (
      !window.confirm(
        `Delete the prefill for ${item.recipientEmail ?? item.recipientName ?? 'this link'}?${extra}`,
      )
    )
      return;
    setBusyId(item.id);
    try {
      const res = await fetch(`/api/forms/${formId}/prefills/${item.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data: { error?: string } = await res.json().catch(() => ({}));
        toast.error(data.error ?? 'Could not delete the prefill.');
        return;
      }
      toast.success('Prefill deleted');
      router.refresh();
    } catch {
      toast.error('Could not delete the prefill.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="prefills">
      <div className="prefills-toolbar">
        {isLive ? (
          <a className="button" href={`/f/${slug}/prefill`} target="_blank" rel="noreferrer">
            New prefill
          </a>
        ) : (
          <p className="form-field-help">Publish the form to send prefilled links.</p>
        )}
      </div>
      {initialPrefills.length === 0 ? (
        <div className="prefills-empty">
          <p>No prefills yet.</p>
          <p className="form-field-help">
            Fill in some answers, enter an email address, and we&apos;ll send them a personal link.
          </p>
        </div>
      ) : (
        <table className="prefills-table">
          <thead>
            <tr>
              <th>Recipient</th>
              <th>Status</th>
              <th>Sent</th>
              <th>Sent by</th>
              <th aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {initialPrefills.map((item) => (
              <tr key={item.id}>
                <td>
                  <div className="prefills-recipient">
                    {item.recipientName ? <strong>{item.recipientName}</strong> : null}
                    <span>
                      {item.recipientEmail ??
                        (item.status === 'draft' ? 'Not sent yet' : 'Shared as a link')}
                    </span>
                  </div>
                </td>
                <td>
                  <span className={`prefills-status prefills-status--${item.status}`}>
                    {STATUS_LABEL[item.status]}
                  </span>
                </td>
                <td>{new Date(item.sentAt).toLocaleDateString('en-AU')}</td>
                <td>{item.createdBy ?? '—'}</td>
                <td className="prefills-actions">
                  {item.status === 'draft' ? (
                    <a className="button button--small" href={item.continueHref}>
                      Continue
                    </a>
                  ) : null}
                  {item.status !== 'expired' && item.status !== 'draft' ? (
                    <button
                      type="button"
                      className="button button--secondary button--small"
                      onClick={() => {
                        void navigator.clipboard.writeText(item.url).then(
                          () => toast.success('Link copied'),
                          () => toast.error('Could not copy the link'),
                        );
                      }}
                    >
                      Copy link
                    </button>
                  ) : null}
                  {item.recipientEmail &&
                  item.status !== 'draft' &&
                  item.status !== 'expired' &&
                  item.status !== 'completed' ? (
                    <button
                      type="button"
                      className="button button--secondary button--small"
                      disabled={busyId === item.id}
                      onClick={() => void resend(item)}
                    >
                      Resend
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="button button--secondary button--small"
                    disabled={busyId === item.id}
                    onClick={() => void remove(item)}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
