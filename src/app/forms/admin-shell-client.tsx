'use client';

import type { UserRole } from '@prisma/client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { type ReactNode, useEffect, useRef, useState } from 'react';
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
  /** True once this org's trial has passed trialEndsAt (see isTrialExpired in
   * plan-limits.ts) — computed fresh on every /forms/* page load in layout.tsx, not
   * cached on the session, since a platform admin assigning a plan should clear this
   * banner on the very next navigation, not up to 24h later on session refresh. Sign-in
   * itself is never blocked by this (see src/lib/auth.ts) — write actions and public form
   * access are what actually get cut off, enforced server-side regardless of whether this
   * banner is seen or dismissed. */
  trialExpired: boolean;
  children: ReactNode;
}

function TrialExpiredBanner() {
  return (
    <div className="admin-trial-banner" role="alert">
      <span className="admin-trial-banner-text">
        Your trial has ended. Live forms are offline and changes are paused until you subscribe.
      </span>
      <span className="admin-trial-banner-actions">
        <Link href="/pricing" className="admin-trial-banner-link">
          View plans
        </Link>
        <Link href="/contact" className="admin-trial-banner-link admin-trial-banner-link--ghost">
          Contact us
        </Link>
      </span>
    </div>
  );
}

export function AdminShellClient({
  email,
  name,
  userRole,
  isPlatformAdmin,
  isTemporaryOrgJoin,
  logoUrl,
  organizationName,
  trialExpired,
  children,
}: AdminShellClientProps) {
  // Two independent booleans behind one button, because the sidebar means something
  // different at each breakpoint: on desktop it's "narrow icon rail vs full width"
  // (persisted, since that's a standing preference); on mobile it's "overlay open vs
  // closed" (never persisted — a mobile visitor should always land with it closed).
  // The sidebar hamburger toggles collapse on desktop; the header hamburger is mobile
  // (and Account settings overlay) only, since the rail is off-canvas there.
  // Defaults to collapsed (rather than reading localStorage after mount and flipping)
  // so the very first render already matches the common case and there's no visible
  // snap on refresh — localStorage is only consulted to opt back into the expanded rail
  // when a visitor had explicitly chosen that.
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
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
    // sidebarCollapsed already defaults to true, so only act when a visitor had
    // explicitly expanded it before (stored '0') — nothing to do for '1'/unset.
    if (window.localStorage.getItem(COLLAPSE_STORAGE_KEY) === '0') {
      setSidebarCollapsed(false);
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

  // Same idea for the desktop rail: once a visitor picks a destination, put the full
  // labeled sidebar away and drop back to the narrow icon-only rail, rather than leaving
  // it expanded over the page indefinitely. Skip this on the very first run so a page
  // *load* still honors whatever collapsed/expanded state was persisted — only an actual
  // in-app navigation (a pathname change after mount) should trigger the auto-collapse.
  const isFirstPathnameRun = useRef(true);
  // biome-ignore lint/correctness/useExhaustiveDependencies: pathname is the intentional trigger, its value is never read
  useEffect(() => {
    if (isFirstPathnameRun.current) {
      isFirstPathnameRun.current = false;
      return;
    }
    setSidebarCollapsed(true);
    window.localStorage.setItem(COLLAPSE_STORAGE_KEY, '1');
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
          {trialExpired ? <TrialExpiredBanner /> : null}
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
