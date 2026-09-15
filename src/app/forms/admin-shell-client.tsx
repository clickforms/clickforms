'use client';

import type { UserRole } from '@prisma/client';
import { usePathname } from 'next/navigation';
import { type ReactNode, useEffect, useState } from 'react';
import { AdminHeader } from '@/app/forms/admin-header';
import { AdminSidebar } from '@/app/forms/admin-sidebar';
import { ToastProvider } from '@/components/toast';

const COLLAPSE_STORAGE_KEY = 'forms-admin-sidebar-collapsed';
const THEME_STORAGE_KEY = 'forms-admin-theme';

interface AdminShellClientProps {
  email: string;
  name: string | null;
  userRole: UserRole;
  isPlatformAdmin: boolean;
  /** See prisma/schema.prisma PlatformAdminOrgAccess — true while a platform admin is
   * temporarily viewing this organisation via "Join this organisation", not because
   * they're a genuine employee here. Labels the account menu identity; the header chip
   * (TemporaryOrgBanner) determines its own visibility independently via useSession(). */
  isTemporaryOrgJoin: boolean;
  /** Presigned S3 GET URL for the org's uploaded logo (see /forms/organisation), shown
   * in the header brand lockup in place of the default Clickforms wordmark. Null when
   * no logo has been uploaded. */
  logoUrl: string | null;
  /** Shown in the header in place of the per-page title (Dashboard, Forms, etc.) —
   * the org's own name is more useful there than which page you're on, since the
   * sidebar nav already highlights the active page. */
  organizationName: string;
  children: ReactNode;
}

export function AdminShellClient({
  email,
  name,
  userRole,
  isPlatformAdmin,
  isTemporaryOrgJoin,
  logoUrl,
  organizationName,
  children,
}: AdminShellClientProps) {
  // Two independent booleans behind one button, because the sidebar means something
  // different at each breakpoint: on desktop it's "narrow icon rail vs full width"
  // (persisted, since that's a standing preference); on mobile it's "overlay open vs
  // closed" (never persisted — a mobile visitor should always land with it closed).
  // The sidebar hamburger toggles collapse on desktop; the header hamburger is mobile
  // (and Account settings overlay) only, since the rail is off-canvas there.
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  // Dark/light theme for the authenticated app shell only — scoped to .admin-shell (see
  // the [data-theme='dark'] overrides in globals.css) so the public marketing/auth pages,
  // which have their own light-only design, are never affected by this.
  const [isDarkTheme, setIsDarkTheme] = useState(false);
  const pathname = usePathname();
  // Account settings uses the light Personal Settings rail as its left column (see the
  // reference chrome). The dark app sidebar stays available from the header hamburger as
  // an overlay, rather than sitting beside that rail.
  const isAccountSettings = pathname.startsWith('/forms/settings');

  useEffect(() => {
    if (window.localStorage.getItem(COLLAPSE_STORAGE_KEY) === '1') {
      setSidebarCollapsed(true);
    }
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

  // Close the mobile overlay automatically after navigating — otherwise it stays open
  // over the newly-loaded page and the visitor has to dismiss it by hand every time.
  // biome-ignore lint/correctness/useExhaustiveDependencies: pathname is the intentional trigger, its value is never read
  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  function toggleSidebar() {
    if (isAccountSettings) {
      setMobileNavOpen((prev) => !prev);
      return;
    }

    setSidebarCollapsed((prev) => {
      const next = !prev;
      window.localStorage.setItem(COLLAPSE_STORAGE_KEY, next ? '1' : '0');
      return next;
    });
    setMobileNavOpen((prev) => !prev);
  }

  const shellClassName = [
    'admin-shell',
    sidebarCollapsed && !isAccountSettings ? 'admin-shell--sidebar-collapsed' : '',
    mobileNavOpen ? 'admin-shell--mobile-nav-open' : '',
    isAccountSettings ? 'admin-shell--account-settings' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <ToastProvider>
      <div className={shellClassName} data-theme={isDarkTheme ? 'dark' : 'light'}>
        <AdminSidebar
          collapsed={isAccountSettings ? false : sidebarCollapsed}
          userRole={userRole}
          isDarkTheme={isDarkTheme}
          onToggleTheme={toggleTheme}
          onToggleSidebar={toggleSidebar}
        />
        {/* Tapping the scrim closes the overlay, same as tapping the hamburger again.
            Visible below 768px, and on Account settings at any width (the dark rail is
            hidden there so the hamburger opens it as an overlay). */}
        <button
          type="button"
          className="admin-mobile-nav-backdrop"
          aria-label="Close navigation menu"
          tabIndex={mobileNavOpen ? 0 : -1}
          onClick={() => setMobileNavOpen(false)}
        />
        <div className="admin-content">
          <AdminHeader
            email={email}
            name={name}
            isPlatformAdmin={isPlatformAdmin}
            isTemporaryOrgJoin={isTemporaryOrgJoin}
            onToggleSidebar={toggleSidebar}
            logoUrl={logoUrl}
            organizationName={organizationName}
          />
          <main className="admin-main">{children}</main>
        </div>
      </div>
    </ToastProvider>
  );
}
