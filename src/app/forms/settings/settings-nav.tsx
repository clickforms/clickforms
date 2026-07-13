'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

function UserDetailsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <circle cx="9" cy="6" r="3" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M4 15.5c0-2.5 2.2-4 5-4s5 1.5 5 4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function KeyIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <circle cx="7" cy="11" r="3.5" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M10 8.5l5.5-5.5M13.5 3h2.5v2.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <rect
        x="5.5"
        y="2.5"
        width="7"
        height="13"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <line
        x1="8"
        y1="4.5"
        x2="10"
        y2="4.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <circle cx="9" cy="13.5" r="0.75" fill="currentColor" />
    </svg>
  );
}

const NAV_ITEMS = [
  { href: '/forms/settings/user-details', label: 'User Details', icon: UserDetailsIcon },
  { href: '/forms/settings/change-password', label: 'Change Password', icon: KeyIcon },
  { href: '/forms/settings/two-factor', label: 'Two-Factor Authentication', icon: PhoneIcon },
] as const;

export function SettingsNav() {
  const pathname = usePathname();

  return (
    <nav className="settings-nav" aria-label="Personal settings">
      <p className="settings-nav-heading">Personal Settings</p>
      <ul className="settings-nav-list">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`settings-nav-item ${active ? 'settings-nav-item--active' : ''}`}
              >
                <span className="settings-nav-icon">
                  <Icon />
                </span>
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function SettingsShell({ children }: { children: ReactNode }) {
  return (
    <div className="settings-shell">
      <SettingsNav />
      <div className="settings-content">{children}</div>
    </div>
  );
}
