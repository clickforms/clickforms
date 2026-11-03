'use client';

import { useEffect, useRef } from 'react';
import './prefill-send-modal.css';

interface PrefillSendModalProps {
  formId?: string;
  email: string;
  name: string;
  note: string;
  sending: boolean;
  sent: { email: string; url: string } | null;
  onEmail: (value: string) => void;
  onName: (value: string) => void;
  onNote: (value: string) => void;
  onSend: () => void;
  onClose: () => void;
  onCopy: (url: string) => void;
}

/** Modal for emailing a prefilled form to one recipient (admin prefill builder only). */
export function PrefillSendModal({
  formId,
  email,
  name,
  note,
  sending,
  sent,
  onEmail,
  onName,
  onNote,
  onSend,
  onClose,
  onCopy,
}: PrefillSendModalProps) {
  const emailRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    emailRef.current?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape' && !sending) onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, sending]);

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: backdrop click-to-dismiss; Escape and the close button cover keyboard users
    <div
      className="pfm-overlay"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !sending) onClose();
      }}
    >
      <div className="pfm-dialog" role="dialog" aria-modal="true" aria-labelledby="pfm-title">
        <button type="button" className="pfm-close" aria-label="Close" onClick={onClose}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path
              d="m3 3 8 8M11 3l-8 8"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
        </button>

        {sent ? (
          <div className="pfm-body pfm-body--sent">
            <span className="pfm-success-icon" aria-hidden="true">
              <svg width="26" height="26" viewBox="0 0 26 26" fill="none" aria-hidden="true">
                <path
                  d="m6 13.5 4.5 4.5L20 8.5"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <h2 id="pfm-title" className="pfm-title">
              Form sent
            </h2>
            <p className="pfm-sub">
              {sent.email} will get an email with their personal link. You can track it, resend it
              or delete it from the Prefills tab.
            </p>
            <div className="pfm-actions pfm-actions--center">
              <a className="pfm-btn pfm-btn--ghost" href={`/forms/${formId}/prefills`}>
                View prefills
              </a>
              <button
                type="button"
                className="pfm-btn pfm-btn--ghost"
                onClick={() => onCopy(sent.url)}
              >
                Copy link
              </button>
              <button type="button" className="pfm-btn pfm-btn--primary" onClick={onClose}>
                Done
              </button>
            </div>
          </div>
        ) : (
          <form
            className="pfm-body"
            onSubmit={(event) => {
              event.preventDefault();
              onSend();
            }}
          >
            <h2 id="pfm-title" className="pfm-title">
              Send prefilled form
            </h2>
            <p className="pfm-sub">
              They&apos;ll get an email with a personal link to this form, with your answers already
              filled in. They can change anything before submitting.
            </p>

            <div className="pfm-field">
              <label htmlFor="pfm-email">Email address</label>
              <input
                id="pfm-email"
                ref={emailRef}
                type="email"
                required
                placeholder="name@example.com"
                value={email}
                onChange={(event) => onEmail(event.target.value)}
              />
            </div>
            <div className="pfm-field">
              <label htmlFor="pfm-name">
                Name <span className="pfm-optional">Optional</span>
              </label>
              <input
                id="pfm-name"
                type="text"
                value={name}
                onChange={(event) => onName(event.target.value)}
              />
            </div>
            <div className="pfm-field">
              <label htmlFor="pfm-note">
                Message <span className="pfm-optional">Optional</span>
              </label>
              <textarea
                id="pfm-note"
                rows={3}
                placeholder="Add a short note to go with the email"
                value={note}
                onChange={(event) => onNote(event.target.value)}
              />
            </div>

            <p className="pfm-hint">The link expires in 30 days.</p>

            <div className="pfm-actions">
              <button
                type="button"
                className="pfm-btn pfm-btn--ghost"
                disabled={sending}
                onClick={onClose}
              >
                Cancel
              </button>
              <button type="submit" className="pfm-btn pfm-btn--primary" disabled={sending}>
                {sending ? 'Sending…' : 'Send email'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
