'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { type ReactNode, useEffect, useState } from 'react';
import { AccountMenu } from '@/app/forms/account-menu';
import { BrandMark } from '@/components/brand-mark';
import { ThemeToggleIconButton } from '@/components/theme-toggle';
import { ToastProvider } from '@/components/toast';
import '@/app/admin/admin-platform-nav.css';

const NAV_ITEMS = [
  { label: 'Overview', href: '/admin' },
  { label: 'Organisations', href: '/admin/organisations' },
  { label: 'Users', href: '/admin/users' },
  { label: 'Templates', href: '/admin/templates' },
  { label: 'Billing', href: '/admin/billing' },
  { label: 'Insights', href: '/admin/insights' },
  { label: 'Reviews', href: '/admin/reviews' },
  { label: 'Audit log', href: '/admin/audit-log' },
  { label: 'Team', href: '/admin/team' },
] as const;

const THEME_STORAGE_KEY = 'admin-platform-theme';

interface AdminPlatformShellProps {
  email: string;
  name: string | null;
  belongsToOrganization: boolean;
  /** Name of the organisation `belongsToOrganization` refers to — lets the account
   * menu's "Log in to <org>" link name it instead of speaking generically. Null when
   * belongsToOrganization is false. */
  organizationName: string | null;
  children: ReactNode;
}

/**
 * Top-bar-only shell for the /admin (Clickforms platform-staff) area — no sidebar; the
 * six sections (Overview, Organisations, Users, Billing, Audit log, Team) fit as a
 * horizontal nav rather than needing the many-page org workspace
 * src/app/forms/admin-shell-client.tsx serves. Reuses the same
 * .admin-shell/.admin-content/.admin-header/.admin-main classes, which work standalone
 * (the sidebar is just a flex sibling elsewhere, not a layout dependency).
 */
export function AdminPlatformShell({
  email,
  name,
  belongsToOrganization,
  organizationName,
  children,
}: AdminPlatformShellProps) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  function isActive(href: string): boolean {
    return href === '/admin' ? pathname === '/admin' : pathname.startsWith(href);
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: close the mobile menu on navigation
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setMenuOpen(false);
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [menuOpen]);

  // Independent from the org workspace's own dark/light preference (forms-admin-theme,
  // set in AdminShellClient) — a platform staffer might reasonably want one area dark
  // and the other light, same reasoning as the two shells' separately-scoped sidebar
  // collapse state.
  const [isDarkTheme, setIsDarkTheme] = useState(false);

  useEffect(() => {
    if (window.localStorage.getItem(THEME_STORAGE_KEY) === 'dark') {
      setIsDarkTheme(true);
    }
  }, []);

  function toggleTheme() {
    setIsDarkTheme((prev) => {
      const next = !prev;
      window.localStorage.setItem(THEME_STORAGE_KEY, next ? 'dark' : 'light');
      return next;
    });
  }

  return (
    <ToastProvider>
      <div className="admin-shell" data-theme={isDarkTheme ? 'dark' : 'light'}>
        <div className="admin-content">
          <header className="admin-header">
            <div className="admin-header-left">
              <Link href="/admin" className="admin-platform-brand">
                <BrandMark size={22} />
                <span>Clickforms Admin</span>
              </Link>
              <nav className="admin-platform-nav" aria-label="Clickforms Admin">
                {NAV_ITEMS.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`admin-platform-nav-link${isActive(item.href) ? ' admin-platform-nav-link--active' : ''}`}
                    aria-current={isActive(item.href) ? 'page' : undefined}
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
            </div>
            <div className="admin-header-right">
              <button
                type="button"
                className="admin-platform-menu-toggle"
                aria-label={menuOpen ? 'Close menu' : 'Open menu'}
                aria-expanded={menuOpen}
                aria-controls="admin-platform-mobile-menu"
                onClick={() => setMenuOpen((value) => !value)}
              >
                <span className="admin-platform-menu-bars" aria-hidden="true" />
              </button>
              <ThemeToggleIconButton isDarkTheme={isDarkTheme} onToggleTheme={toggleTheme} />
              <AccountMenu
                email={email}
                name={name}
                isPlatformAdmin
                belongsToOrganization={belongsToOrganization}
                organizationName={organizationName}
              />
            </div>
          </header>
          {menuOpen ? (
            <nav
              id="admin-platform-mobile-menu"
              className="admin-platform-mobile-menu"
              aria-label="Clickforms Admin"
            >
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="admin-platform-mobile-link"
                  data-active={isActive(item.href) || undefined}
                  aria-current={isActive(item.href) ? 'page' : undefined}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          ) : null}
          <main className="admin-main">{children}</main>
        </div>
      </div>
    </ToastProvider>
  );
}
