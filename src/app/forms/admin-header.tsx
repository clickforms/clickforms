'use client';

import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { useState } from 'react';
import { LogoutConfirmModal } from '@/app/forms/logout-confirm-modal';

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

function getPageTitle(pathname: string): string {
  if (pathname === '/forms') return 'Dashboard';
  if (pathname === '/forms/list') return 'Forms';
  if (pathname.startsWith('/forms/settings')) return 'Account Settings';
  if (pathname === '/forms/users') return 'Users';
  if (pathname.startsWith('/forms/files')) return 'Files';
  if (pathname.includes('/builder')) return 'Builder';
  if (pathname.includes('/submissions/')) return 'Submission';
  if (pathname.includes('/submissions')) return 'Responses';
  return 'Clickforms';
}

interface AdminHeaderProps {
  email: string;
  onToggleSidebar: () => void;
}

export function AdminHeader({ email, onToggleSidebar }: AdminHeaderProps) {
  const pathname = usePathname();
  const title = getPageTitle(pathname);
  const displayEmail = email.length > 24 ? `${email.slice(0, 21)}…` : email;
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  async function handleConfirmSignOut() {
    setIsSigningOut(true);
    await signOut({ callbackUrl: '/login' });
  }

  return (
    <header className="admin-header">
      <div className="admin-header-left">
        <button
          type="button"
          className="admin-header-menu"
          onClick={onToggleSidebar}
          aria-label="Toggle navigation menu"
        >
          <MenuIcon />
        </button>
        <h1 className="admin-header-title">{title}</h1>
      </div>
      <div className="admin-header-right">
        <span className="admin-header-account" title={email}>
          {displayEmail}
        </span>
        <button type="button" className="admin-header-signout" onClick={() => setLogoutOpen(true)}>
          Sign out
        </button>
      </div>

      <LogoutConfirmModal
        open={logoutOpen}
        isSigningOut={isSigningOut}
        onClose={() => setLogoutOpen(false)}
        onConfirm={handleConfirmSignOut}
      />
    </header>
  );
}
