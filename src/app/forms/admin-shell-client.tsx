'use client';

import type { UserRole } from '@prisma/client';
import { usePathname } from 'next/navigation';
import { type ReactNode, useEffect, useState } from 'react';
import { AdminHeader } from '@/app/forms/admin-header';
import { AdminSidebar } from '@/app/forms/admin-sidebar';
import { ToastProvider } from '@/components/toast';

const COLLAPSE_STORAGE_KEY = 'forms-admin-sidebar-collapsed';

interface AdminShellClientProps {
  email: string;
  userRole: UserRole;
  children: ReactNode;
}

export function AdminShellClient({ email, userRole, children }: AdminShellClientProps) {
  // Two independent booleans behind one button, because the sidebar means something
  // different at each breakpoint: on desktop it's "narrow icon rail vs full width"
  // (persisted, since that's a standing preference); on mobile it's "overlay open vs
  // closed" (never persisted — a mobile visitor should always land with it closed).
  // The header's single hamburger toggles both; only one is ever visually relevant at
  // a given viewport width, since the CSS for each is scoped to its own media query.
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    if (window.localStorage.getItem(COLLAPSE_STORAGE_KEY) === '1') {
      setSidebarCollapsed(true);
    }
  }, []);

  // Close the mobile overlay automatically after navigating — otherwise it stays open
  // over the newly-loaded page and the visitor has to dismiss it by hand every time.
  // biome-ignore lint/correctness/useExhaustiveDependencies: pathname is the intentional trigger, its value is never read
  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  function toggleSidebar() {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      window.localStorage.setItem(COLLAPSE_STORAGE_KEY, next ? '1' : '0');
      return next;
    });
    setMobileNavOpen((prev) => !prev);
  }

  const shellClassName = [
    'admin-shell',
    sidebarCollapsed ? 'admin-shell--sidebar-collapsed' : '',
    mobileNavOpen ? 'admin-shell--mobile-nav-open' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <ToastProvider>
      <div className={shellClassName}>
        <AdminSidebar collapsed={sidebarCollapsed} userRole={userRole} />
        {/* Tapping the scrim closes the overlay, same as tapping the hamburger again —
            only rendered/visible below the 768px breakpoint (see globals.css). */}
        <button
          type="button"
          className="admin-mobile-nav-backdrop"
          aria-label="Close navigation menu"
          tabIndex={mobileNavOpen ? 0 : -1}
          onClick={() => setMobileNavOpen(false)}
        />
        <div className="admin-content">
          <AdminHeader email={email} onToggleSidebar={toggleSidebar} />
          <main className="admin-main">{children}</main>
        </div>
      </div>
    </ToastProvider>
  );
}
