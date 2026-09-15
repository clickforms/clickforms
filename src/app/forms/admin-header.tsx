'use client';

import Link from 'next/link';
import { AccountMenu } from '@/app/forms/account-menu';
import { TemporaryOrgBanner } from '@/app/forms/temporary-org-banner';
import { BrandMark } from '@/components/brand-mark';

function MenuIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <line
        x1="2"
        y1="5"
        x2="16"
        y2="5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <line
        x1="2"
        y1="9"
        x2="16"
        y2="9"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <line
        x1="2"
        y1="13"
        x2="16"
        y2="13"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

interface AdminHeaderProps {
  email: string;
  name: string | null;
  isPlatformAdmin: boolean;
  isTemporaryOrgJoin: boolean;
  onToggleSidebar: () => void;
  logoUrl: string | null;
  /** Shown in place of the per-page title (Dashboard, Forms, etc.) — the org's own name
   * is more useful here than which page you're on. */
  organizationName: string;
}

export function AdminHeader({
  email,
  name,
  isPlatformAdmin,
  isTemporaryOrgJoin,
  onToggleSidebar,
  logoUrl,
  organizationName,
}: AdminHeaderProps) {
  return (
    <header className={`admin-header${isTemporaryOrgJoin ? ' admin-header--staff-view' : ''}`}>
      <div className="admin-header-left">
        <button
          type="button"
          className="admin-header-menu"
          onClick={onToggleSidebar}
          aria-label="Open navigation menu"
        >
          <MenuIcon />
        </button>
        <h1 className="admin-header-title">{organizationName}</h1>
        <Link href="/forms" className="admin-header-brand">
          {logoUrl ? (
            <span className="admin-header-logo">
              {/* biome-ignore lint/performance/noImgElement: presigned S3 URL, not a static asset next/image can optimize */}
              <img src={logoUrl} alt="" />
            </span>
          ) : (
            <>
              <BrandMark size={22} id="admin-header" />
              <span className="admin-header-brand-text">Clickforms</span>
            </>
          )}
        </Link>
      </div>
      <div className="admin-header-right">
        <TemporaryOrgBanner />
        <AccountMenu
          email={email}
          name={name}
          isPlatformAdmin={isPlatformAdmin}
          isTemporaryOrgJoin={isTemporaryOrgJoin}
        />
      </div>
    </header>
  );
}
