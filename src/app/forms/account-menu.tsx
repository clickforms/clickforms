'use client';

import Link from 'next/link';
import { signOut } from 'next-auth/react';
import { useEffect, useRef, useState } from 'react';
import { LogoutConfirmModal } from '@/app/forms/logout-confirm-modal';

function getInitials(name: string | null, email: string): string {
  const source = name?.trim();
  if (source) {
    const words = source.split(/\s+/).filter(Boolean);
    if (words.length >= 2) {
      return `${words[0]![0]}${words[1]![0]}`.toUpperCase();
    }
    return source.slice(0, 2).toUpperCase();
  }
  return email.slice(0, 2).toUpperCase();
}

function SettingsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="2.1" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M8 2.5v1.4M8 12.1v1.4M13.5 8h-1.4M3.9 8H2.5M11.8 4.2l-1 1M5.2 10.8l-1 1M11.8 11.8l-1-1M5.2 5.2l-1-1"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SignOutIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M6.5 2.5h-3a1 1 0 00-1 1v9a1 1 0 001 1h3"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M10.5 11l3-3-3-3M13.25 8h-7.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

interface AccountMenuProps {
  email: string;
  name: string | null;
}

export function AccountMenu({ email, name }: AccountMenuProps) {
  const [open, setOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const displayName = name?.trim() || email;
  const initials = getInitials(name, email);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  async function handleConfirmSignOut() {
    setIsSigningOut(true);
    await signOut({ callbackUrl: '/login' });
  }

  return (
    <div className="account-menu" ref={wrapperRef}>
      <button
        type="button"
        className="account-menu-trigger"
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="menu"
        aria-expanded={open}
        title={displayName}
      >
        <span className="account-avatar" aria-hidden="true">
          {initials}
        </span>
      </button>

      {open ? (
        // biome-ignore lint/a11y/noNoninteractiveElementToInteractiveRole: WAI-ARIA APG menu pattern, matches FormActionsMenu's panel elsewhere in the app
        <ul className="account-menu-panel" role="menu">
          <li className="account-menu-identity" role="none">
            <span className="account-avatar account-avatar--lg" aria-hidden="true">
              {initials}
            </span>
            <span className="account-menu-identity-copy">
              {name?.trim() ? <strong>{name}</strong> : null}
              <span className="account-menu-email">{email}</span>
            </span>
          </li>
          <li role="none">
            <hr className="actions-menu-divider" />
          </li>
          <li role="none">
            <Link
              href="/forms/settings"
              className="actions-menu-item"
              role="menuitem"
              onClick={() => setOpen(false)}
            >
              <span className="actions-menu-icon">
                <SettingsIcon />
              </span>
              Account settings
            </Link>
          </li>
          <li role="none">
            <button
              type="button"
              className="actions-menu-item actions-menu-item--danger"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                setLogoutOpen(true);
              }}
            >
              <span className="actions-menu-icon">
                <SignOutIcon />
              </span>
              Sign out
            </button>
          </li>
        </ul>
      ) : null}

      <LogoutConfirmModal
        open={logoutOpen}
        isSigningOut={isSigningOut}
        onClose={() => setLogoutOpen(false)}
        onConfirm={handleConfirmSignOut}
      />
    </div>
  );
}
