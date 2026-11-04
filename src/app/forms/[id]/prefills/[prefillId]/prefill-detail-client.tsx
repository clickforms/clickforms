'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { useToast } from '@/components/toast';
import { formatDateTime, formatShortDate } from '@/lib/format-date';
import type { CompareRow } from '@/lib/forms/prefill-compare';
import '@/app/forms/[id]/prefills/prefills.css';
import { useMounted } from '@/components/local-date';

type Status = 'draft' | 'review' | 'sent' | 'opened' | 'started' | 'completed' | 'expired';

const STATUS_LABEL: Record<Status, string> = {
  draft: 'Draft',
  review: 'Needs review',
  sent: 'Sent',
  opened: 'Opened',
  started: 'In progress',
  completed: 'Completed',
  expired: 'Expired',
};

const ROW_TAG: Record<string, string> = {
  changed: 'Changed',
  added: 'Added by client',
  cleared: 'Cleared by client',
};

function initials(name: string): string {
  const parts = name.split(/[\s@._-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '?') + (parts[1]?.[0] ?? '')).toUpperCase();
}

interface Props {
  formId: string;
  slug: string;
  prefillId: string;
  status: Status;
  recipientName: string | null;
  recipientEmail: string | null;
  url: string;
  sentAt: string;
  openedAt: string | null;
  createdBy: string | null;
  returnedAt: string | null;
  responseId: string | null;
  held: boolean;
  rows: CompareRow[];
}

export function PrefillDetailClient(props: Props) {
  const { formId, slug, prefillId, status, held, rows } = props;
  const router = useRouter();
  const toast = useToast();
  const mounted = useMounted();
  const [busy, setBusy] = useState<string | null>(null);
  const [onlyChanges, setOnlyChanges] = useState(false);
  const [confirm, setConfirm] = useState<'promote' | 'discard' | 'delete' | null>(null);

  const title =
    props.recipientName ||
    props.recipientEmail ||
    (status === 'draft' ? 'Untitled draft' : 'Shared link');
  const hasResponse = rows.some((r) => r.status !== 'original-only');
  const changedCount = rows.filter((r) =>
    ['changed', 'added', 'cleared'].includes(r.status),
  ).length;
  const visibleRows = useMemo(
    () =>
      onlyChanges ? rows.filter((r) => ['changed', 'added', 'cleared'].includes(r.status)) : rows,
    [rows, onlyChanges],
  );

  async function call(action: 'promote' | 'discard' | 'delete' | 'resend') {
    setBusy(action);
    try {
      const base = `/api/forms/${formId}/prefills/${prefillId}`;
      const res =
        action === 'delete'
          ? await fetch(base, { method: 'DELETE' })
          : await fetch(`${base}/${action}`, { method: 'POST' });
      const data: { error?: string } = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? 'Something went wrong.');
        return;
      }
      setConfirm(null);
      if (action === 'delete') {
        toast.success('Prefill deleted');
        router.push(`/forms/${formId}/prefills`);
        return;
      }
      toast.success(
        action === 'promote'
          ? 'Promoted to Responses'
          : action === 'discard'
            ? 'Response discarded'
            : `Email re-sent to ${props.recipientEmail}`,
      );
      router.refresh();
    } catch {
      toast.error('Something went wrong.');
    } finally {
      setBusy(null);
    }
  }

  function copy() {
    void navigator.clipboard.writeText(props.url).then(
      () => toast.success('Link copied'),
      () => toast.error('Could not copy the link'),
    );
  }

  const canResend = Boolean(props.recipientEmail) && ['sent', 'opened', 'started'].includes(status);

  return (
    <>
      <div className="pfd-header">
        <div className="pfd-who">
          <span className={`pf-avatar pfd-avatar${status === 'draft' ? ' pf-avatar--draft' : ''}`}>
            {initials(title)}
          </span>
          <div className="pfd-who-text">
            <h1>{title}</h1>
            <p>
              {props.recipientEmail && props.recipientName ? props.recipientEmail : null}
              {!props.recipientEmail
                ? status === 'draft'
                  ? 'Not sent yet'
                  : 'Shared as a link'
                : null}
            </p>
          </div>
          <span className={`pf-status pf-status--${status === 'review' ? 'review' : status}`}>
            <i aria-hidden="true" />
            {STATUS_LABEL[status]}
          </span>
        </div>
        <div className="pfd-actions">
          {held ? (
            <>
              <button
                type="button"
                className="pf-btn pf-btn--primary"
                disabled={busy !== null}
                onClick={() => setConfirm('promote')}
              >
                Promote to response
              </button>
              <button
                type="button"
                className="pf-btn pf-btn--ghost"
                disabled={busy !== null}
                onClick={() => setConfirm('discard')}
              >
                Discard response
              </button>
            </>
          ) : null}
          {status === 'draft' ? (
            <a className="pf-btn pf-btn--primary" href={`/f/${slug}/prefill?draft=${prefillId}`}>
              Continue editing
            </a>
          ) : (
            <a className="pf-btn pf-btn--ghost" href={`/f/${slug}/prefill?from=${prefillId}`}>
              Send to someone else
            </a>
          )}
          {status !== 'draft' && status !== 'expired' ? (
            <button type="button" className="pf-btn pf-btn--ghost" onClick={copy}>
              Copy link
            </button>
          ) : null}
          {canResend ? (
            <button
              type="button"
              className="pf-btn pf-btn--ghost"
              disabled={busy !== null}
              onClick={() => void call('resend')}
            >
              Resend
            </button>
          ) : null}
          <button
            type="button"
            className="pf-btn pf-btn--ghost pf-btn--dangerline"
            disabled={busy !== null}
            onClick={() => setConfirm('delete')}
          >
            Delete
          </button>
        </div>
      </div>

      <div className="pfd-meta">
        <div>
          <span>Sent</span>
          <strong>{formatShortDate(props.sentAt, mounted)}</strong>
        </div>
        <div>
          <span>Opened</span>
          <strong>{props.openedAt ? formatDateTime(props.openedAt, mounted) : '—'}</strong>
        </div>
        <div>
          <span>Returned</span>
          <strong>{props.returnedAt ? formatDateTime(props.returnedAt, mounted) : '—'}</strong>
        </div>
        <div>
          <span>Sent by</span>
          <strong>{props.createdBy ?? '—'}</strong>
        </div>
      </div>

      {held ? (
        <div className="pfd-banner">
          <strong>Waiting for your review.</strong> This response isn&apos;t in Responses yet. Check
          what changed, then promote it.
        </div>
      ) : null}
      {status === 'completed' && props.responseId ? (
        <div className="pfd-banner pfd-banner--ok">
          This response is in Responses.{' '}
          <a href={`/forms/${formId}/submissions/${props.responseId}`}>Open response</a>
        </div>
      ) : null}

      <div className="pf-card">
        <div className="pf-toolbar">
          <div className="pfd-card-title">
            <h2>{hasResponse ? 'Sent vs returned' : 'Answers sent'}</h2>
            <p>
              {hasResponse
                ? changedCount === 0
                  ? 'The client changed nothing.'
                  : `${changedCount} ${changedCount === 1 ? 'field' : 'fields'} changed by the client.`
                : 'The prefill as it was sent. This copy never changes.'}
            </p>
          </div>
          {hasResponse ? (
            <label className="pfd-switch">
              <input
                type="checkbox"
                checked={onlyChanges}
                onChange={(e) => setOnlyChanges(e.target.checked)}
              />
              <span aria-hidden="true" />
              Changes only
            </label>
          ) : null}
        </div>
        <div className="pf-scroll">
          <table className="pf-table pfd-table">
            <thead>
              <tr>
                <th>Field</th>
                <th>Sent</th>
                {hasResponse ? <th>Returned</th> : null}
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row) => {
                const differs = ['changed', 'added', 'cleared'].includes(row.status);
                return (
                  <tr key={row.fieldId} className={differs ? 'pfd-row--changed' : undefined}>
                    <td className="pfd-field">
                      {row.label}
                      {differs ? <em>{ROW_TAG[row.status]}</em> : null}
                    </td>
                    <td className={row.original ? undefined : 'pf-muted'}>{row.original ?? '—'}</td>
                    {hasResponse ? (
                      <td className={row.returned ? (differs ? 'pfd-new' : undefined) : 'pf-muted'}>
                        {row.returned ?? '—'}
                      </td>
                    ) : null}
                  </tr>
                );
              })}
              {visibleRows.length === 0 ? (
                <tr>
                  <td colSpan={3} className="pf-none">
                    {onlyChanges ? 'No differences.' : 'No answers.'}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      {confirm ? (
        // biome-ignore lint/a11y/noStaticElementInteractions: backdrop click-to-dismiss
        <div
          className="pf-overlay"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && busy === null) setConfirm(null);
          }}
        >
          <div className="pf-dialog" role="dialog" aria-modal="true">
            <h2>
              {confirm === 'promote'
                ? 'Promote to response?'
                : confirm === 'discard'
                  ? 'Discard this response?'
                  : 'Delete this prefill?'}
            </h2>
            <p>
              {confirm === 'promote'
                ? 'It will appear in Responses and count as a submitted response. The prefill and its original answers stay here.'
                : confirm === 'discard'
                  ? 'The returned response is deleted for good. The prefill stays, and the link can be used again.'
                  : held
                    ? 'Promote or discard the returned response first.'
                    : 'Its link will stop working. Any response already in Responses is kept.'}
            </p>
            <div className="pf-dialog-actions">
              <button
                type="button"
                className="pf-btn pf-btn--ghost"
                disabled={busy !== null}
                onClick={() => setConfirm(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className={`pf-btn ${confirm === 'promote' ? 'pf-btn--primary' : 'pf-btn--danger'}`}
                disabled={busy !== null || (confirm === 'delete' && held)}
                onClick={() => void call(confirm)}
              >
                {busy
                  ? 'Working…'
                  : confirm === 'promote'
                    ? 'Promote'
                    : confirm === 'discard'
                      ? 'Discard'
                      : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
