'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { type MouseEvent, type ReactNode, useState } from 'react';
import { FormShareModal } from '@/app/forms/[id]/form-share-modal';
import { useFormWorkspaceStatus } from '@/app/forms/[id]/form-workspace-context';
import { LiveStatusBadge } from '@/components/live-status-badge';

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

function ExternalLinkIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M6.5 4H4a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1V9.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <path
        d="M9 3h4v4M7.5 8.5 13 3"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ShareLinkIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M8 9.25V2.75M8 2.75 5.6 5.15M8 2.75l2.4 2.4"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M3.5 8.25v3.5A1.25 1.25 0 0 0 4.75 13h6.5A1.25 1.25 0 0 0 12.5 11.75v-3.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
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
  /** Display name of the signed-in builder — used only for the Share modal's send copy;
   *  the actual send re-derives this from the session server-side. */
  senderName: string;
}

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
  const { status, isLive, hasUnsavedChanges } = useFormWorkspaceStatus();
  const [shareOpen, setShareOpen] = useState(false);

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
    <>
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
            <a
              href={publicUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="form-top-nav-preview"
            >
              <ExternalLinkIcon />
              View live
            </a>
          ) : null}
          {isLive ? (
            <button
              type="button"
              className="form-top-nav-share"
              onClick={() => setShareOpen(true)}
              aria-haspopup="dialog"
            >
              <ShareLinkIcon />
              Share
            </button>
          ) : null}
        </div>
      </nav>
      <FormShareModal
        open={shareOpen}
        formId={formId}
        formName={formName}
        publicUrl={publicUrl}
        senderName={senderName}
        onClose={() => setShareOpen(false)}
      />
    </>
  );
}
