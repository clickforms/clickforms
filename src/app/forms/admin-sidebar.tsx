'use client';

import type { UserRole } from '@prisma/client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { BrandMark } from '@/components/brand-mark';
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

function BuildingIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <rect x="4" y="2.5" width="8" height="13" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M12 7.5h2a0.5 0.5 0 0 1 0.5 0.5v7a0.5 0.5 0 0 1-0.5 0.5h-2"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <line
        x1="6.5"
        y1="5.5"
        x2="9.5"
        y2="5.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <line
        x1="6.5"
        y1="8.5"
        x2="9.5"
        y2="8.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <line
        x1="6.5"
        y1="11.5"
        x2="9.5"
        y2="11.5"
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

function SunIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M8 1.5v1.4M8 13.1v1.4M2.9 2.9l1 1M12.1 12.1l1 1M1.5 8h1.4M13.1 8h1.4M2.9 13.1l1-1M12.1 3.9l1-1"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M13.8 9.9A5.8 5.8 0 1 1 6.1 2.2a4.6 4.6 0 0 0 7.7 7.7Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
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
  const sections: NavSection[] = [
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
        // Files (org-wide submission file browser) crosses form-ownership boundaries a
        // `member` role can't otherwise see (see formsListWhere in lib/user-roles.ts) —
        // a real link for admins, an inert placeholder for everyone else.
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
        { kind: 'disabled', key: 'logs', label: 'Logs', icon: <LogsIcon /> },
      ],
    },
  ];

  // Org-super-admin-only section — unlike the "Admin" section above (which always shows,
  // with disabled placeholders for lower roles), this one is only relevant to org admins
  // at all, so it's omitted entirely rather than shown-but-disabled. Consolidates the two
  // org-wide-authority pages (Users, Organisation Details) that used to live in different
  // places (top-level "Admin" section / nested inside Account Settings) into one spot.
  if (canManageUsersFlag) {
    sections.push({
      label: 'Organisation',
      items: [
        {
          kind: 'link',
          key: 'users',
          href: '/forms/users',
          label: 'Users',
          icon: <UsersIcon />,
          match: (pathname) => pathname.startsWith('/forms/users'),
        },
        {
          kind: 'link',
          key: 'organisation',
          href: '/forms/organisation',
          label: 'Organisation Details',
          icon: <BuildingIcon />,
          match: (pathname) => pathname.startsWith('/forms/organisation'),
        },
      ],
    });
  }

  return sections;
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

function ThemeToggle({
  isDarkTheme,
  onToggleTheme,
}: {
  isDarkTheme: boolean;
  onToggleTheme: () => void;
}) {
  return (
    <button
      type="button"
      className="theme-toggle"
      role="switch"
      aria-checked={isDarkTheme}
      onClick={onToggleTheme}
    >
      <span className="theme-toggle-left">
        <span className="admin-sidebar-nav-icon">{isDarkTheme ? <MoonIcon /> : <SunIcon />}</span>
        <span className="admin-sidebar-nav-item-label">
          {isDarkTheme ? 'Dark mode' : 'Light mode'}
        </span>
      </span>
      <span className="theme-toggle-track" aria-hidden="true">
        <span className="theme-toggle-thumb" />
      </span>
    </button>
  );
}

export function AdminSidebar({
  collapsed,
  userRole,
  isDarkTheme,
  onToggleTheme,
}: {
  collapsed: boolean;
  userRole: UserRole;
  isDarkTheme: boolean;
  onToggleTheme: () => void;
}) {
  const pathname = usePathname();
  const navSections = buildNavSections(canManageUsers(userRole));

  return (
    <aside className={`admin-sidebar ${collapsed ? 'admin-sidebar--collapsed' : ''}`}>
      <Link href="/forms" className="admin-brand-block">
        <span className="admin-brand-mark">
          <BrandMark size={22} id="admin-sidebar" />
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
        <ThemeToggle isDarkTheme={isDarkTheme} onToggleTheme={onToggleTheme} />
      </div>
    </aside>
  );
}
