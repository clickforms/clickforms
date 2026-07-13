'use client';

import type { UserRole } from '@prisma/client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { canManageUsers } from '@/lib/user-roles';

function DashboardIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path d="M3 3h5.5v5.5H3V3Z" stroke="currentColor" strokeWidth="1.5" />
      <path d="M9.5 3H15v5.5H9.5V3Z" stroke="currentColor" strokeWidth="1.5" />
      <path d="M3 9.5h5.5V15H3V9.5Z" stroke="currentColor" strokeWidth="1.5" />
      <path d="M9.5 9.5H15V15H9.5V9.5Z" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function FormsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <rect x="3" y="2" width="12" height="14" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <line
        x1="6"
        y1="6"
        x2="12"
        y2="6"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <line
        x1="6"
        y1="9"
        x2="12"
        y2="9"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <line
        x1="6"
        y1="12"
        x2="10"
        y2="12"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function FilesIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path
        d="M4 4.5h4l1.5 1.5H14a1.5 1.5 0 0 1 1.5 1.5v6.5a1.5 1.5 0 0 1-1.5 1.5H4a1.5 1.5 0 0 1-1.5-1.5V6a1.5 1.5 0 0 1 1.5-1.5Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <circle cx="9" cy="5.5" r="2.5" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M4 15c0-2.75 2.25-4.5 5-4.5s5 1.75 5 4.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function LogsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path
        d="M4 4.5h10M4 9h10M4 13.5h6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M13.5 12.5l1.5 1.5-1.5 1.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <circle cx="9" cy="9" r="2.25" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M9 2.5v1.6M9 13.9v1.6M2.5 9h1.6M13.9 9h1.6M4.4 4.4l1.1 1.1M12.5 12.5l1.1 1.1M4.4 13.6l1.1-1.1M12.5 5.5l1.1-1.1"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function BrandMark() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
      <path
        d="M11 3c-3.5 2.5-6 5.5-6 9a6 6 0 1 0 12 0c0-3.5-2.5-6.5-6-9Z"
        fill="currentColor"
        opacity="0.9"
      />
      <path d="M11 8v6M8.5 11h5" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

interface NavLinkItem {
  kind: 'link';
  key: string;
  href: string;
  label: string;
  icon: ReactNode;
  match?: (pathname: string) => boolean;
}

interface NavDisabledItem {
  kind: 'disabled';
  key: string;
  label: string;
  icon: ReactNode;
}

type NavItem = NavLinkItem | NavDisabledItem;

function buildNavSections(canManageUsersFlag: boolean): NavSection[] {
  return [
    {
      label: 'Overview',
      items: [
        {
          kind: 'link',
          key: 'dashboard',
          href: '/forms',
          label: 'Dashboard',
          icon: <DashboardIcon />,
          match: (pathname) => pathname === '/forms',
        },
      ],
    },
    {
      label: 'Forms',
      items: [
        {
          kind: 'link',
          key: 'forms',
          href: '/forms/list',
          label: 'Forms',
          icon: <FormsIcon />,
          match: (pathname) => pathname === '/forms/list',
        },
      ],
    },
    {
      label: 'Admin',
      items: [
        // Files (org-wide submission file browser) and Users both cross form-ownership
        // boundaries a `member` role can't otherwise see (see formsListWhere in
        // lib/user-roles.ts) — gated the same way: a real link for admins, an inert
        // placeholder for everyone else.
        canManageUsersFlag
          ? {
              kind: 'link',
              key: 'files',
              href: '/forms/files',
              label: 'Files',
              icon: <FilesIcon />,
              match: (pathname) => pathname.startsWith('/forms/files'),
            }
          : { kind: 'disabled', key: 'files', label: 'Files', icon: <FilesIcon /> },
        canManageUsersFlag
          ? {
              kind: 'link',
              key: 'users',
              href: '/forms/users',
              label: 'Users',
              icon: <UsersIcon />,
              match: (pathname) => pathname.startsWith('/forms/users'),
            }
          : { kind: 'disabled', key: 'users', label: 'Users', icon: <UsersIcon /> },
        { kind: 'disabled', key: 'logs', label: 'Logs', icon: <LogsIcon /> },
      ],
    },
  ];
}

interface NavSection {
  label: string;
  items: NavItem[];
}

function NavEntry({
  item,
  pathname,
  collapsed,
}: {
  item: NavItem;
  pathname: string;
  collapsed: boolean;
}) {
  if (item.kind === 'disabled') {
    return (
      // biome-ignore lint/a11y/useAriaPropsSupportedByRole: the label text is already visible inside as a child span — aria-label here is a collapsed-state-only enhancement, not the sole accessible name source
      <span
        className="admin-sidebar-nav-item admin-sidebar-nav-item--disabled"
        aria-label={collapsed ? `${item.label} (Coming soon)` : undefined}
      >
        <span className="admin-sidebar-nav-icon">{item.icon}</span>
        <span className="admin-sidebar-nav-item-label">{item.label}</span>
      </span>
    );
  }

  const isActive = item.match ? item.match(pathname) : pathname.startsWith(item.href);
  return (
    <Link
      href={item.href}
      className={`admin-sidebar-nav-item ${isActive ? 'admin-sidebar-nav-item--active' : ''}`}
      aria-label={collapsed ? item.label : undefined}
    >
      <span className="admin-sidebar-nav-icon">{item.icon}</span>
      <span className="admin-sidebar-nav-item-label">{item.label}</span>
    </Link>
  );
}

export function AdminSidebar({ collapsed, userRole }: { collapsed: boolean; userRole: UserRole }) {
  const pathname = usePathname();
  const navSections = buildNavSections(canManageUsers(userRole));

  return (
    <aside className={`admin-sidebar ${collapsed ? 'admin-sidebar--collapsed' : ''}`}>
      <Link href="/forms" className="admin-brand-block">
        <span className="admin-brand-mark">
          <BrandMark />
        </span>
        <span className="admin-brand-text">Clickforms</span>
      </Link>

      <nav className="admin-sidebar-nav" aria-label="Main navigation">
        {navSections.map((section) => (
          <div key={section.label} className="admin-sidebar-section">
            <p className="admin-sidebar-section-label">{section.label}</p>
            {section.items.map((item) => (
              <NavEntry key={item.key} item={item} pathname={pathname} collapsed={collapsed} />
            ))}
          </div>
        ))}
      </nav>

      <div className="admin-sidebar-footer">
        <p className="admin-sidebar-section-label">My company</p>
        <Link
          href="/forms/settings"
          className={`admin-sidebar-nav-item ${pathname.startsWith('/forms/settings') ? 'admin-sidebar-nav-item--active' : ''}`}
          aria-label={collapsed ? 'Account Settings' : undefined}
        >
          <span className="admin-sidebar-nav-icon">
            <SettingsIcon />
          </span>
          <span className="admin-sidebar-nav-item-label">Account Settings</span>
        </Link>
      </div>
    </aside>
  );
}
