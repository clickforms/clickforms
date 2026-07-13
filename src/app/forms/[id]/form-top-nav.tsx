'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

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
      <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M8 2v1.5M8 12.5V14M2 8h1.5M12.5 8H14M4 4l1 1M11 11l1 1M4 12l1-1M11 5l1-1"
        stroke="currentColor"
        strokeWidth="1.3"
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

interface FormTopNavProps {
  formId: string;
  formName: string;
  slug: string;
  responseCount: number;
}

type NavItem =
  | {
      kind: 'link';
      key: string;
      href: string;
      label: string;
      icon: ReactNode;
      match: (path: string) => boolean;
      badge?: number;
    }
  | { kind: 'disabled'; key: string; label: string; icon: ReactNode; hint: string };

export function FormTopNav({ formId, formName, slug, responseCount }: FormTopNavProps) {
  const pathname = usePathname();

  const submissionDetailMatch = pathname.match(/\/forms\/[^/]+\/submissions\/([^/]+)$/);
  const submissionId = submissionDetailMatch?.[1] ?? null;
  const previewHref = submissionId
    ? `/f/${slug}/submissions/${submissionId}/preview`
    : `/f/${slug}/preview`;
  const previewLabel = submissionId ? 'Preview response' : 'Preview';

  // Order and labels mirror a typical admin top tab bar: Form Builder, Form Settings, Form
  // Responses — with the responses tab carrying a count badge so it's obvious at a glance.
  const navItems: NavItem[] = [
    {
      kind: 'link',
      key: 'builder',
      href: `/forms/${formId}/builder`,
      label: 'Form Builder',
      icon: <BuilderIcon />,
      match: (path) => path.includes(`/forms/${formId}/builder`),
    },
    {
      kind: 'disabled',
      key: 'settings',
      label: 'Form Settings',
      icon: <SettingsIcon />,
      hint: 'Emails, workflows, and permissions — not built yet',
    },
    {
      kind: 'link',
      key: 'responses',
      href: `/forms/${formId}/submissions`,
      label: 'Form Responses',
      icon: <ResponsesIcon />,
      match: (path) => path.includes(`/forms/${formId}/submissions`),
      badge: responseCount,
    },
  ];

  function renderItem(item: NavItem) {
    if (item.kind === 'disabled') {
      return (
        <li key={item.key} className="form-top-nav-item">
          <span className="form-top-nav-tab form-top-nav-tab--disabled" title={item.hint}>
            <span className="form-top-nav-tab-icon">{item.icon}</span>
            <span className="form-top-nav-tab-label">{item.label}</span>
          </span>
        </li>
      );
    }

    const isActive = item.match(pathname);

    return (
      <li key={item.key} className="form-top-nav-item">
        <Link
          href={item.href}
          className={`form-top-nav-tab ${isActive ? 'form-top-nav-tab--active' : ''}`}
          aria-current={isActive ? 'page' : undefined}
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

      <Link
        href={previewHref}
        target="_blank"
        rel="noopener noreferrer"
        className="form-top-nav-preview"
      >
        <PreviewIcon />
        {previewLabel}
      </Link>
    </nav>
  );
}
