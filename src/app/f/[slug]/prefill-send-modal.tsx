'use client';

import { useEffect, useRef, useState } from 'react';
import './prefill-send-modal.css';

interface PrefillSendModalProps {
  formId?: string;
  mode: 'email' | 'link';
  onMode: (mode: 'email' | 'link') => void;
  email: string;
  name: string;
  note: string;
  sending: boolean;
  sent: { email: string | null; url: string } | null;
  onEmail: (value: string) => void;
  onName: (value: string) => void;
  onNote: (value: string) => void;
  onSend: () => void;
  onClose: () => void;
  onCopy: (url: string) => void;
}

/** Modal for sharing a prefilled form — by email, or as a link to copy (admin prefill builder). */
export function PrefillSendModal({
  formId,
  mode,
  onMode,
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
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const [showNote, setShowNote] = useState(note.length > 0);

  useEffect(() => {
    firstFieldRef.current?.focus();
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
              {sent.email ? 'Form sent' : 'Link ready'}
            </h2>
            <p className="pfm-sub">
              {sent.email
                ? `${sent.email} will get an email with their personal link. You can track it, resend it or delete it from the Prefills tab.`
                : 'Copy the link and send it however you like. It works for one person and expires in 30 days. You can find it again in the Prefills tab.'}
            </p>
            {!sent.email ? (
              <div className="pfm-linkbox">
                <input
                  type="text"
                  readOnly
                  value={sent.url}
                  aria-label="Prefilled link"
                  onFocus={(event) => event.target.select()}
                />
                <button
                  type="button"
                  className="pfm-btn pfm-btn--primary"
                  onClick={() => onCopy(sent.url)}
                >
                  Copy
                </button>
              </div>
            ) : null}
            <div className="pfm-actions pfm-actions--center">
              <a className="pfm-btn pfm-btn--ghost" href={`/forms/${formId}/prefills`}>
                View prefills
              </a>
              {sent.email ? (
                <button
                  type="button"
                  className="pfm-btn pfm-btn--ghost"
                  onClick={() => onCopy(sent.url)}
                >
                  Copy link
                </button>
              ) : null}
              <button
                type="button"
                className={`pfm-btn ${sent.email ? 'pfm-btn--primary' : 'pfm-btn--ghost'}`}
                onClick={onClose}
              >
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
              Share prefilled form
            </h2>
            <p className="pfm-sub">Your answers are filled in. They can change anything.</p>

            <div className="pfm-tabs" role="tablist" aria-label="How to share">
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'email'}
                className="pfm-tab"
                onClick={() => onMode('email')}
              >
                Send by email
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'link'}
                className="pfm-tab"
                onClick={() => onMode('link')}
              >
                Copy link
              </button>
            </div>

            {mode === 'email' ? (
              <>
                <div className="pfm-field">
                  <label htmlFor="pfm-email">Email address</label>
                  <input
                    id="pfm-email"
                    ref={firstFieldRef}
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
                {showNote ? (
                  <div className="pfm-field">
                    <label htmlFor="pfm-note">Message</label>
                    <textarea
                      id="pfm-note"
                      rows={3}
                      placeholder="Add a short note to go with the email"
                      value={note}
                      onChange={(event) => onNote(event.target.value)}
                    />
                  </div>
                ) : (
                  <button type="button" className="pfm-addlink" onClick={() => setShowNote(true)}>
                    + Add a message
                  </button>
                )}
              </>
            ) : (
              <div className="pfm-field">
                <label htmlFor="pfm-link-name">
                  Who is it for? <span className="pfm-optional">Optional</span>
                </label>
                <input
                  id="pfm-link-name"
                  ref={firstFieldRef}
                  type="text"
                  placeholder="e.g. Sarah Jones — so you can find it later"
                  value={name}
                  onChange={(event) => onName(event.target.value)}
                />
              </div>
            )}

            <div className="pfm-actions pfm-actions--split">
              <span className="pfm-hint">Link expires in 30 days</span>
              <span className="pfm-actions-right">
                <button
                  type="button"
                  className="pfm-btn pfm-btn--ghost"
                  disabled={sending}
                  onClick={onClose}
                >
                  Cancel
                </button>
                <button type="submit" className="pfm-btn pfm-btn--primary" disabled={sending}>
                  {sending ? 'Working…' : mode === 'email' ? 'Send email' : 'Create link'}
                </button>
              </span>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
