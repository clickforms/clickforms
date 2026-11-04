'use client';

import { useEffect, useRef, useState } from 'react';
import './prefill-send-modal.css';

interface PrefillSendModalProps {
  formId?: string;
  mode: 'email' | 'link';
  onMode: (mode: 'email' | 'link') => void;
  emails: string[];
  name: string;
  note: string;
  sending: boolean;
  sent: { emails: string[]; url: string } | null;
  onEmails: (value: string[]) => void;
  onName: (value: string) => void;
  onNote: (value: string) => void;
  onSend: (emails: string[]) => void;
  onClose: () => void;
  onCopy: (url: string) => void;
}

/** Modal for sharing a prefilled form — by email, or as a link to copy (admin prefill builder). */
export function PrefillSendModal({
  formId,
  mode,
  onMode,
  emails,
  name,
  note,
  sending,
  sent,
  onEmails,
  onName,
  onNote,
  onSend,
  onClose,
  onCopy,
}: PrefillSendModalProps) {
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState('');
  const [showNote, setShowNote] = useState(note.length > 0);

  useEffect(() => {
    firstFieldRef.current?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape' && !sending) onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, sending]);

  const [pendingError, setPendingError] = useState<string | null>(null);

  /** Turns typed/pasted text into email chips; returns the full list. Invalid entries stay in the box. */
  function commitPending(extra?: string): string[] {
    const text = `${pending} ${extra ?? ''}`;
    const tokens = text.split(/[\s,;]+/).filter(Boolean);
    const valid: string[] = [];
    const invalid: string[] = [];
    for (const token of tokens) {
      if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(token)) valid.push(token.toLowerCase());
      else invalid.push(token);
    }
    const merged = [...new Set([...emails, ...valid])];
    if (valid.length > 0) onEmails(merged);
    setPending(invalid.join(' '));
    setPendingError(invalid.length > 0 ? `“${invalid[0]}” isn’t a valid email address` : null);
    return merged;
  }

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
              {sent.emails.length > 0 ? 'Form sent' : 'Link ready'}
            </h2>
            <p className="pfm-sub">
              {sent.emails.length > 0
                ? `${
                    sent.emails.length === 1 ? sent.emails[0] : `${sent.emails.length} people`
                  } will get an email with ${sent.emails.length === 1 ? 'their' : 'a'} personal link. Each one is tracked separately in the Prefills tab, where you can compare what you sent with what comes back.`
                : 'Copy the link and send it however you like. It works for one person and expires in 30 days. You can find it again in the Prefills tab.'}
            </p>
            {sent.emails.length === 0 ? (
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
              {sent.emails.length > 0 && sent.emails.length === 1 ? (
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
                className={`pfm-btn ${sent.emails.length > 0 ? 'pfm-btn--primary' : 'pfm-btn--ghost'}`}
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
              const all = mode === 'email' ? commitPending() : [];
              onSend(all);
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
                  <label htmlFor="pfm-email">
                    Email addresses{' '}
                    <span className="pfm-optional">
                      Add several to send to each person separately
                    </span>
                  </label>
                  <div className="pfm-chips">
                    {emails.map((address) => (
                      <span key={address} className="pfm-chip">
                        {address}
                        <button
                          type="button"
                          aria-label={`Remove ${address}`}
                          onClick={() => onEmails(emails.filter((e) => e !== address))}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                    <input
                      id="pfm-email"
                      ref={firstFieldRef}
                      type="text"
                      inputMode="email"
                      placeholder={emails.length === 0 ? 'name@example.com' : 'Add another'}
                      value={pending}
                      onChange={(event) => setPending(event.target.value)}
                      onKeyDown={(event) => {
                        if (['Enter', ',', ' ', ';'].includes(event.key) && pending.trim()) {
                          event.preventDefault();
                          commitPending();
                        } else if (event.key === 'Backspace' && !pending && emails.length > 0) {
                          onEmails(emails.slice(0, -1));
                        }
                      }}
                      onBlur={() => void commitPending()}
                      onPaste={(event) => {
                        const text = event.clipboardData.getData('text');
                        if (/[\s,;]/.test(text.trim())) {
                          event.preventDefault();
                          commitPending(text);
                        }
                      }}
                    />
                  </div>
                  {pendingError ? <p className="pfm-error">{pendingError}</p> : null}
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
                  placeholder="e.g. Sarah Jones"
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
