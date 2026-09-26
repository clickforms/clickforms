'use client';

import { useEffect, useRef, useState } from 'react';
import { RichTextEditor } from '@/app/forms/[id]/builder/rich-text-editor';
import { useToast } from '@/components/toast';
import { formShareEmail, formShareEmailDefaultMessage } from '@/lib/emails/templates';
import { readApiError } from '@/lib/error-message';
import { formShareSms, formShareSmsDefaultMessage } from '@/lib/sms-templates';

type ShareChannel = 'email' | 'sms';

// SMS sending isn't fully live yet (no MessageMedia credentials configured) — hide the
// channel switcher and lock the modal to email-only until that's revisited. Nothing on
// the backend was touched: formShareSms()/sendSms()/the API route's 'sms' branch all
// still work, this just removes the UI entry point. Flip back to true to restore it.
const SMS_SHARE_ENABLED = false;

const EMAIL_PATTERN = /^\S+@\S+\.\S+$/;
const PHONE_PATTERN = /^\+?[1-9]\d{7,14}$/;

function GlobeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M2.5 8h11" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M8 2.5c1.7 1.7 2.6 3.6 2.6 5.5S9.7 11.8 8 13.5C6.3 11.8 5.4 9.9 5.4 8S6.3 4.2 8 2.5Z"
        stroke="currentColor"
        strokeWidth="1.4"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M3.5 8.3 6.4 11.2 12.5 4.8"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="m10.5 3.5 2 2M3 13l.6-2.8 7.8-7.8a1.4 1.4 0 0 1 2 2l-7.8 7.8L3 13Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={`form-share-preview-chevron${open ? ' form-share-preview-chevron--open' : ''}`}
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="m4.5 6 3.5 3.5L11.5 6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="5" cy="10" r="2.25" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="15" cy="5" r="2.25" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="15" cy="15" r="2.25" stroke="currentColor" strokeWidth="1.6" />
      <path d="m7 9 5.9-3M7 11l5.9 3" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

interface FormShareModalProps {
  open: boolean;
  formId: string;
  formName: string;
  publicUrl: string;
  senderName: string;
  onClose: () => void;
}

export function FormShareModal({
  open,
  formId,
  formName,
  publicUrl,
  senderName,
  onClose,
}: FormShareModalProps) {
  const toast = useToast();
  const dialogRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const [channel, setChannel] = useState<ShareChannel>('email');
  const [recipient, setRecipient] = useState('');
  // Tiptap reads its initial document during mount. Starting with the real email body
  // avoids an empty first frame before the open/reset effect runs.
  const [message, setMessage] = useState(() =>
    formShareEmailDefaultMessage({ senderName, formName }),
  );
  const [editingMessage, setEditingMessage] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);

  function defaultMessageFor(next: ShareChannel) {
    return next === 'email'
      ? formShareEmailDefaultMessage({ senderName, formName })
      : formShareSmsDefaultMessage({ senderName, formName, formUrl: publicUrl });
  }

  useEffect(() => {
    if (!open) return;
    setCopied(false);
    setChannel('email');
    setRecipient('');
    setMessage(formShareEmailDefaultMessage({ senderName, formName }));
    setEditingMessage(false);
    setPreviewOpen(false);
    setIsSending(false);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const frame = window.requestAnimationFrame(() => dialogRef.current?.focus());
    return () => {
      document.body.style.overflow = previousOverflow;
      window.cancelAnimationFrame(frame);
    };
  }, [open, senderName, formName]);

  useEffect(() => {
    if (!open || isSending) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, isSending, onClose]);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1800);
    return () => window.clearTimeout(timer);
  }, [copied]);

  if (!open) return null;

  const recipientIsValid =
    channel === 'email'
      ? EMAIL_PATTERN.test(recipient.trim())
      : PHONE_PATTERN.test(recipient.trim());

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
    } catch {
      toast.error('Could not copy link — select and copy manually');
    }
  }

  function handleChannelChange(next: ShareChannel) {
    setChannel(next);
    setRecipient('');
    setMessage(defaultMessageFor(next));
    setEditingMessage(false);
    setPreviewOpen(false);
  }

  const previewEmail =
    channel === 'email'
      ? formShareEmail({ senderName, formName, formUrl: publicUrl, message })
      : null;
  const previewSms =
    channel === 'sms' ? formShareSms({ senderName, formName, formUrl: publicUrl, message }) : null;

  async function handleSend() {
    if (!recipientIsValid) return;
    setIsSending(true);
    try {
      const res = await fetch(`/api/forms/${formId}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel,
          recipient: recipient.trim(),
          message: message.trim(),
        }),
      });
      if (!res.ok) {
        toast.error(await readApiError(res, 'Could not send — please try again'));
        return;
      }
      toast.success(channel === 'email' ? 'Email sent' : 'SMS sent');
      onClose();
    } catch {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setIsSending(false);
    }
  }

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: click-outside-to-dismiss backdrop; Escape and Close are also wired up
    <div className="modal-overlay form-share-overlay" onMouseDown={() => !isSending && onClose()}>
      <div
        ref={dialogRef}
        className="modal-card form-share-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="form-share-modal-title"
        tabIndex={-1}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="form-share-head">
          <div className="form-share-head-identity">
            <span className="form-share-head-icon">
              <ShareIcon />
            </span>
            <div className="form-share-head-copy">
              <h2 className="form-share-title" id="form-share-modal-title">
                Share form
              </h2>
              <p className="form-share-subtitle">{formName}</p>
            </div>
          </div>
          <button
            type="button"
            className="form-share-close"
            onClick={onClose}
            aria-label="Close"
            disabled={isSending}
          >
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path
                d="M3 3l8 8M11 3l-8 8"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </header>

        <div className="form-share-body">
          <section className="form-share-access" aria-labelledby="form-share-access-label">
            <div className="form-share-access-meta">
              <span className="form-share-access-icon">
                <GlobeIcon />
              </span>
              <div>
                <h3 className="form-share-access-title" id="form-share-access-label">
                  Public form link
                </h3>
              </div>
            </div>

            <div className="form-share-url-field">
              <input
                className="form-share-url"
                value={publicUrl}
                readOnly
                spellCheck={false}
                aria-label="Live form link"
                onFocus={(event) => event.currentTarget.select()}
                onClick={(event) => event.currentTarget.select()}
              />
              <button
                type="button"
                className={`form-share-copy${copied ? ' form-share-copy--done' : ''}`}
                onClick={() => void handleCopyLink()}
              >
                {copied ? (
                  <>
                    <CheckIcon />
                    Copied
                  </>
                ) : (
                  'Copy'
                )}
              </button>
            </div>
          </section>

          <section className="form-share-send-block" aria-labelledby="form-share-send-label">
            <div className="form-share-send-head">
              <div>
                <h3 className="form-share-section-label" id="form-share-send-label">
                  Send directly
                </h3>
              </div>
              {SMS_SHARE_ENABLED ? (
                <div className="form-share-segment" role="tablist" aria-label="Send method">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={channel === 'email'}
                    className={`form-share-segment-btn${channel === 'email' ? ' form-share-segment-btn--active' : ''}`}
                    onClick={() => handleChannelChange('email')}
                  >
                    Email
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={channel === 'sms'}
                    className={`form-share-segment-btn${channel === 'sms' ? ' form-share-segment-btn--active' : ''}`}
                    onClick={() => handleChannelChange('sms')}
                  >
                    SMS
                  </button>
                </div>
              ) : null}
            </div>

            <form
              className="form-share-send"
              onSubmit={(event) => {
                event.preventDefault();
                if (recipientIsValid) void handleSend();
              }}
            >
              <label className="form-share-field" htmlFor="form-share-recipient">
                <span>{channel === 'email' ? 'Recipient email' : 'Recipient phone number'}</span>
                <input
                  id="form-share-recipient"
                  className="text-input"
                  type={channel === 'email' ? 'email' : 'tel'}
                  placeholder={channel === 'email' ? 'name@example.com' : '+61491570156'}
                  value={recipient}
                  onChange={(event) => setRecipient(event.target.value)}
                  disabled={isSending}
                  autoComplete={channel === 'email' ? 'email' : 'tel'}
                />
              </label>
              <div className="form-share-field">
                <div className="form-share-field-head">
                  <span>Message</span>
                  <button
                    type="button"
                    className="form-share-preview-toggle"
                    onClick={() => setEditingMessage((value) => !value)}
                    aria-pressed={editingMessage}
                  >
                    {editingMessage ? <CheckIcon /> : <EditIcon />}
                    {editingMessage ? 'Done editing' : 'Edit message'}
                  </button>
                </div>
                {editingMessage ? (
                  channel === 'email' ? (
                    <div className="form-share-rich-editor">
                      <RichTextEditor
                        value={message}
                        onChange={setMessage}
                        disabled={isSending}
                        fields={{}}
                        excludeFieldId="share-email-message"
                        ariaLabel="Email message"
                      />
                    </div>
                  ) : (
                    <textarea
                      id="form-share-message"
                      className="text-input form-share-message"
                      value={message}
                      onChange={(event) => setMessage(event.target.value)}
                      rows={6}
                      maxLength={2000}
                      disabled={isSending}
                    />
                  )
                ) : null}
                {editingMessage ? (
                  <p className="form-share-hint">
                    {channel === 'email'
                      ? 'Formatting is preserved in the email. The form link is added as a button below.'
                      : 'Keep the link in the text so they can open the form.'}
                  </p>
                ) : null}
              </div>

              {!editingMessage && (previewEmail || previewSms) ? (
                <div className="form-share-preview" aria-live="polite">
                  <button
                    type="button"
                    className="form-share-preview-head"
                    onClick={() => setPreviewOpen((value) => !value)}
                    aria-expanded={previewOpen}
                  >
                    <span>{channel === 'email' ? 'Email preview' : 'SMS preview'}</span>
                    <span
                      className="form-share-preview-summary"
                      title={previewEmail?.subject ?? 'Text message'}
                    >
                      {previewEmail?.subject ?? 'Text message'}
                    </span>
                    <ChevronIcon open={previewOpen} />
                  </button>
                  {previewOpen ? (
                    <div className="form-share-preview-content">
                      {previewEmail ? (
                        <iframe
                          className="form-share-email-preview-frame"
                          title="Exact email preview"
                          srcDoc={previewEmail.html}
                          sandbox="allow-same-origin"
                          tabIndex={-1}
                          onLoad={(event) => {
                            const previewDocument = event.currentTarget.contentDocument;
                            if (previewDocument) {
                              event.currentTarget.style.height = `${previewDocument.documentElement.scrollHeight}px`;
                            }
                          }}
                        />
                      ) : (
                        <p className="form-share-preview-bubble">{previewSms}</p>
                      )}
                    </div>
                  ) : null}
                </div>
              ) : null}

              <div className="form-share-footer">
                <button
                  type="submit"
                  className="button button--dark form-share-send-btn"
                  disabled={!recipientIsValid || isSending}
                >
                  {isSending ? 'Sending…' : channel === 'email' ? 'Send email' : 'Send SMS'}
                </button>
              </div>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}
