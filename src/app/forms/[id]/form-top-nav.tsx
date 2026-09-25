'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { type FormEvent, type MouseEvent, type ReactNode, useRef, useState } from 'react';
import { useFormWorkspaceStatus } from '@/app/forms/[id]/form-workspace-context';
import { DropdownMenu } from '@/components/dropdown-menu';
import { LiveStatusBadge } from '@/components/live-status-badge';
import { useToast } from '@/components/toast';
import { formShareEmail } from '@/lib/emails/templates';
import { readApiError } from '@/lib/error-message';
import { formShareSms } from '@/lib/sms-templates';

function BuilderIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="2" y="2" width="12" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
      <line
        x1="5"
        y1="5.5"
        x2="11"
        y2="5.5"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
      <line
        x1="5"
        y1="8"
        x2="11"
        y2="8"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
      <line
        x1="5"
        y1="10.5"
        x2="8.5"
        y2="10.5"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ResponsesIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M3 4h10a1 1 0 0 1 1 1v5.5a1 1 0 0 1-1 1H6.5L3 13V5a1 1 0 0 1 1-1Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <line
        x1="5.5"
        y1="6.5"
        x2="10.5"
        y2="6.5"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
      <line
        x1="5.5"
        y1="9"
        x2="9"
        y2="9"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="2.1" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M8 2.5v1.4M8 12.1v1.4M13.5 8h-1.4M3.9 8H2.5M11.8 4.2l-1 1M5.2 10.8l-1 1M11.8 11.8l-1-1M5.2 5.2l-1-1"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function PreviewIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M1.5 8s2.5-4 6.5-4 6.5 4 6.5 4-2.5 4-6.5 4-6.5-4-6.5-4Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <circle cx="8" cy="8" r="1.75" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

/* Same overlapping-squares glyph as field-card.tsx's CopyIcon and builder-client.tsx's
   own copy icon, kept as a separate component here since those live in different files.
   Used for both the trigger (per user's call — copy is the more familiar glyph here)
   and the "Copy link" row inside the panel it opens. */
function ShareLinkIcon() {
  return (
    <svg width="12.5" height="12.5" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="6" y="6" width="8" height="8" rx="1.4" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M4 10.2V4.8A1.8 1.8 0 0 1 5.8 3h5.4"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="2" y="3.5" width="12" height="9" rx="1.4" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M2.7 4.3 8 8.5l5.3-4.2"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function MessageIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M2.5 4.3A1.4 1.4 0 0 1 3.9 3h8.2a1.4 1.4 0 0 1 1.4 1.4v5.4a1.4 1.4 0 0 1-1.4 1.4H6.6l-2.9 2.1v-2.1H3.9a1.4 1.4 0 0 1-1.4-1.4V4.3Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ExternalLinkIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M6.5 4H4a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1V9.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9.5 2.5H13.5V6.5M13 3 8 8"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

interface FormTopNavProps {
  formId: string;
  formName: string;
  slug: string;
  responseCount: number;
  /** Absolute public URL on the org's subdomain — see FormWorkspaceShellProps for why
   *  this lives up here rather than being computed per-tab. */
  publicUrl: string;
  /** Display name of the signed-in builder — used only for the send-via-email/SMS
   *  preview text below; the actual send re-derives this from the session server-side. */
  senderName: string;
}

type ShareSendChannel = 'email' | 'sms';
type ShareSendStage = 'compose' | 'preview';

const EMAIL_PATTERN = /^\S+@\S+\.\S+$/;
const PHONE_PATTERN = /^\+?[1-9]\d{7,14}$/;

interface NavItem {
  key: string;
  href: string;
  label: string;
  icon: ReactNode;
  match: (path: string) => boolean;
  badge?: number;
}

export function FormTopNav({
  formId,
  formName,
  slug,
  responseCount,
  publicUrl,
  senderName,
}: FormTopNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const toast = useToast();
  const { status, isLive, hasUnsavedChanges } = useFormWorkspaceStatus();
  const [shareOpen, setShareOpen] = useState(false);
  const shareTriggerRef = useRef<HTMLButtonElement>(null);

  // Send-via-email/SMS flow, lives inside the same Share panel as the copy-link row
  // above rather than a separate modal — see form-top-nav.tsx's doc comment on the
  // trigger button for why Share already lives here.
  const [sendChannel, setSendChannel] = useState<ShareSendChannel | null>(null);
  const [sendStage, setSendStage] = useState<ShareSendStage>('compose');
  const [recipient, setRecipient] = useState('');
  const [isSending, setIsSending] = useState(false);

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(publicUrl);
      toast.success('Live link copied to clipboard');
    } catch {
      toast.error('Could not copy link — select and copy manually');
    }
  }

  function resetSendState() {
    setSendChannel(null);
    setSendStage('compose');
    setRecipient('');
  }

  function handleShareOpenChange(next: boolean) {
    setShareOpen(next);
    if (!next) resetSendState();
  }

  function handleStartSend(channel: ShareSendChannel) {
    setSendChannel(channel);
    setSendStage('compose');
    setRecipient('');
  }

  const recipientIsValid =
    sendChannel === 'email'
      ? EMAIL_PATTERN.test(recipient.trim())
      : PHONE_PATTERN.test(recipient.trim());

  function handlePreviewSubmit(event: FormEvent) {
    event.preventDefault();
    if (!recipientIsValid) return;
    setSendStage('preview');
  }

  async function handleSend() {
    if (!sendChannel) return;
    setIsSending(true);
    try {
      const res = await fetch(`/api/forms/${formId}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel: sendChannel, recipient: recipient.trim() }),
      });
      if (!res.ok) {
        toast.error(await readApiError(res, 'Could not send — please try again'));
        return;
      }
      toast.success(sendChannel === 'email' ? 'Email sent' : 'Text message sent');
      setShareOpen(false);
      resetSendState();
    } catch {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setIsSending(false);
    }
  }

  const previewEmail =
    sendChannel === 'email' ? formShareEmail({ senderName, formName, formUrl: publicUrl }) : null;
  const previewSms =
    sendChannel === 'sms' ? formShareSms({ senderName, formName, formUrl: publicUrl }) : null;

  const submissionDetailMatch = pathname.match(/\/forms\/[^/]+\/submissions\/([^/]+)$/);
  const submissionId = submissionDetailMatch?.[1] ?? null;
  const previewHref = submissionId
    ? `/f/${slug}/submissions/${submissionId}/preview`
    : `/f/${slug}/preview`;
  const previewLabel = submissionId ? 'Preview response' : 'Preview';

  const navItems: NavItem[] = [
    {
      key: 'builder',
      href: `/forms/${formId}/builder`,
      label: 'Builder',
      icon: <BuilderIcon />,
      match: (path) => path.includes(`/forms/${formId}/builder`),
    },
    {
      key: 'responses',
      href: `/forms/${formId}/submissions`,
      label: 'Responses',
      icon: <ResponsesIcon />,
      match: (path) => path.includes(`/forms/${formId}/submissions`),
      badge: responseCount,
    },
    {
      key: 'settings',
      href: `/forms/${formId}/settings`,
      label: 'Settings',
      icon: <SettingsIcon />,
      match: (path) => path.includes(`/forms/${formId}/settings`),
    },
  ];

  // The builder has no autosave (see builder-client.tsx) — leaving it mid-edit via one of
  // these tabs would silently abandon whatever's unsaved in the canvas, the same risk
  // beforeunload covers for closing the tab. beforeunload never fires for a client-side
  // route change, so this is the in-app equivalent: block the navigation and confirm.
  function handleNavClick(event: MouseEvent<HTMLAnchorElement>, item: NavItem, isActive: boolean) {
    if (isActive || !hasUnsavedChanges) return;
    event.preventDefault();
    const confirmed = window.confirm(
      'You have unsaved changes in the builder. Leave without saving?',
    );
    if (confirmed) {
      router.push(item.href);
    }
  }

  function renderItem(item: NavItem) {
    const isActive = item.match(pathname);

    return (
      <li key={item.key} className="form-top-nav-item">
        <Link
          href={item.href}
          className={`form-top-nav-tab ${isActive ? 'form-top-nav-tab--active' : ''}`}
          aria-current={isActive ? 'page' : undefined}
          onClick={(event) => handleNavClick(event, item, isActive)}
        >
          <span className="form-top-nav-tab-icon">{item.icon}</span>
          <span className="form-top-nav-tab-label">{item.label}</span>
          {typeof item.badge === 'number' ? (
            <span className="form-top-nav-tab-badge">{item.badge}</span>
          ) : null}
        </Link>
      </li>
    );
  }

  return (
    <nav className="form-top-nav" aria-label={formName}>
      <ul className="form-top-nav-tabs">{navItems.map(renderItem)}</ul>

      <div className="form-top-nav-end">
        <LiveStatusBadge status={status} isLive={isLive} />
        <Link
          href={previewHref}
          target="_blank"
          rel="noopener noreferrer"
          className="form-top-nav-preview"
        >
          <PreviewIcon />
          {previewLabel}
        </Link>
        {isLive ? (
          <>
            {/* Lives here rather than per-tab since the live link is the same regardless
                of which tab (Builder/Responses/Settings) is active — this also covers
                "view the live form from here", so copying the link and opening it sit
                together instead of needing a second control. */}
            <button
              ref={shareTriggerRef}
              type="button"
              className="form-top-nav-preview form-top-nav-share"
              onClick={() => setShareOpen((value) => !value)}
              aria-haspopup="true"
            >
              <ShareLinkIcon />
              Share
            </button>
            <DropdownMenu
              open={shareOpen}
              onOpenChange={handleShareOpenChange}
              triggerRef={shareTriggerRef}
              panelClassName={`actions-menu-panel share-panel ${sendChannel ? 'share-panel--sending' : ''}`}
              align="end"
            >
              <p className="share-panel-label">Live link</p>
              <div className="share-panel-url-row">
                <span className="share-panel-url" title={publicUrl}>
                  {publicUrl}
                </span>
                <button
                  type="button"
                  className="share-panel-copy"
                  onClick={() => {
                    setShareOpen(false);
                    void handleCopyLink();
                  }}
                  aria-label="Copy live link"
                  title="Copy link"
                >
                  <ShareLinkIcon />
                </button>
              </div>
              <a
                href={publicUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="share-panel-view-live"
                onClick={() => setShareOpen(false)}
              >
                View live form
                <ExternalLinkIcon />
              </a>

              {sendChannel === null ? (
                <div className="share-panel-send-row">
                  <button
                    type="button"
                    className="share-panel-send-option"
                    onClick={() => handleStartSend('email')}
                  >
                    <MailIcon />
                    Send via email
                  </button>
                  <button
                    type="button"
                    className="share-panel-send-option"
                    onClick={() => handleStartSend('sms')}
                  >
                    <MessageIcon />
                    Send via SMS
                  </button>
                </div>
              ) : sendStage === 'compose' ? (
                <form className="share-panel-send-compose" onSubmit={handlePreviewSubmit}>
                  <label className="share-panel-send-label" htmlFor="share-send-recipient">
                    {sendChannel === 'email' ? "Recipient's email" : "Recipient's phone number"}
                  </label>
                  <input
                    id="share-send-recipient"
                    className="share-panel-send-input"
                    type={sendChannel === 'email' ? 'email' : 'tel'}
                    placeholder={sendChannel === 'email' ? 'name@example.com' : '+61491570156'}
                    value={recipient}
                    onChange={(event) => setRecipient(event.target.value)}
                  />
                  <div className="share-panel-send-actions">
                    <button
                      type="button"
                      className="share-panel-send-back"
                      onClick={() => setSendChannel(null)}
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      className="share-panel-send-primary"
                      disabled={!recipientIsValid}
                    >
                      Preview
                    </button>
                  </div>
                </form>
              ) : (
                <div className="share-panel-send-preview">
                  {previewEmail ? (
                    <div className="share-panel-email-preview">
                      <p className="share-panel-email-preview-subject">{previewEmail.subject}</p>
                      <p className="share-panel-email-preview-body">{previewEmail.text}</p>
                    </div>
                  ) : null}
                  {previewSms ? (
                    <div className="share-panel-sms-preview">
                      <p className="share-panel-sms-preview-bubble">{previewSms}</p>
                    </div>
                  ) : null}
                  <p className="share-panel-send-recipient-line">
                    Sending to <strong>{recipient.trim()}</strong>
                  </p>
                  <div className="share-panel-send-actions">
                    <button
                      type="button"
                      className="share-panel-send-back"
                      onClick={() => setSendStage('compose')}
                      disabled={isSending}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="share-panel-send-primary"
                      onClick={() => void handleSend()}
                      disabled={isSending}
                    >
                      {isSending ? 'Sending…' : 'Send'}
                    </button>
                  </div>
                </div>
              )}
            </DropdownMenu>
          </>
        ) : null}
      </div>
    </nav>
  );
}
