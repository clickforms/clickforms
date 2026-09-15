'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { AccountMenu } from '@/app/forms/account-menu';
import { BrandMark } from '@/components/brand-mark';
import { ToastProvider } from '@/components/toast';

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
  const onOverview = pathname === '/admin';
  const onOrganisations = pathname.startsWith('/admin/organisations');
  const onUsers = pathname.startsWith('/admin/users');
  const onTemplates = pathname.startsWith('/admin/templates');
  const onBilling = pathname.startsWith('/admin/billing');
  const onAuditLog = pathname.startsWith('/admin/audit-log');
  const onTeam = pathname.startsWith('/admin/team');

  return (
    <ToastProvider>
      <div className="admin-shell" data-theme="light">
        <div className="admin-content">
          <header className="admin-header">
            <div className="admin-header-left">
              <Link href="/admin" className="admin-platform-brand">
                <BrandMark size={22} />
                <span>Clickforms Admin</span>
              </Link>
              <nav className="admin-platform-nav" aria-label="Clickforms Admin">
                <Link
                  href="/admin"
                  className={`admin-platform-nav-link${onOverview ? ' admin-platform-nav-link--active' : ''}`}
                  aria-current={onOverview ? 'page' : undefined}
                >
                  Overview
                </Link>
                <Link
                  href="/admin/organisations"
                  className={`admin-platform-nav-link${onOrganisations ? ' admin-platform-nav-link--active' : ''}`}
                  aria-current={onOrganisations ? 'page' : undefined}
                >
                  Organisations
                </Link>
                <Link
                  href="/admin/users"
                  className={`admin-platform-nav-link${onUsers ? ' admin-platform-nav-link--active' : ''}`}
                  aria-current={onUsers ? 'page' : undefined}
                >
                  Users
                </Link>
                <Link
                  href="/admin/templates"
                  className={`admin-platform-nav-link${onTemplates ? ' admin-platform-nav-link--active' : ''}`}
                  aria-current={onTemplates ? 'page' : undefined}
                >
                  Templates
                </Link>
                <Link
                  href="/admin/billing"
                  className={`admin-platform-nav-link${onBilling ? ' admin-platform-nav-link--active' : ''}`}
                  aria-current={onBilling ? 'page' : undefined}
                >
                  Billing
                </Link>
                <Link
                  href="/admin/audit-log"
                  className={`admin-platform-nav-link${onAuditLog ? ' admin-platform-nav-link--active' : ''}`}
                  aria-current={onAuditLog ? 'page' : undefined}
                >
                  Audit log
                </Link>
                <Link
                  href="/admin/team"
                  className={`admin-platform-nav-link${onTeam ? ' admin-platform-nav-link--active' : ''}`}
                  aria-current={onTeam ? 'page' : undefined}
                >
                  Team
                </Link>
              </nav>
            </div>
            <div className="admin-header-right">
              <AccountMenu
                email={email}
                name={name}
                isPlatformAdmin
                belongsToOrganization={belongsToOrganization}
                organizationName={organizationName}
              />
            </div>
          </header>
          <main className="admin-main">{children}</main>
        </div>
      </div>
    </ToastProvider>
  );
}
