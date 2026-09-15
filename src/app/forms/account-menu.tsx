'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { useEffect, useRef, useState } from 'react';
import { LogoutConfirmModal } from '@/app/forms/logout-confirm-modal';

function getInitials(name: string | null, email: string): string {
  const source = name?.trim();
  if (source) {
    const words = source.split(/\s+/).filter(Boolean);
    if (words.length >= 2) {
      const [first, second] = words;
      return `${first?.[0] ?? ''}${second?.[0] ?? ''}`.toUpperCase();
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

function ShieldIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M8 1.8 13.2 3.8v4c0 3.2-2.2 5.7-5.2 6.4-3-.7-5.2-3.2-5.2-6.4v-4L8 1.8Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path
        d="M5.7 8.1 7.2 9.6l3.1-3.4"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path
        d="M3 4.5l3 3 3-3"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
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
  /** Shows a link into/out of the Clickforms platform-staff area — see prisma/schema.prisma
   * User.isPlatformAdmin. Omitted entirely for everyone else, not just disabled. */
  isPlatformAdmin?: boolean;
  /** False for Clickforms staff who are not a member of any organisation — hides org-workspace links. */
  belongsToOrganization?: boolean;
  /** Name of the organisation `belongsToOrganization` refers to, so the "Log in to
   * <org>" link (shown from /admin) can name it instead of speaking generically.
   * Omitted/null wherever the caller doesn't have it handy (e.g. inside the org
   * workspace itself, where this link isn't shown). */
  organizationName?: string | null;
  /** True while a platform admin is here via "Join this organisation" rather than as a
   * genuine employee — see prisma/schema.prisma PlatformAdminOrgAccess. Labels the
   * identity row; the actual leave action lives in the TemporaryOrgBanner, not here. */
  isTemporaryOrgJoin?: boolean;
}

export function AccountMenu({
  email,
  name,
  isPlatformAdmin = false,
  belongsToOrganization = true,
  organizationName = null,
  isTemporaryOrgJoin = false,
}: AccountMenuProps) {
  const [open, setOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const displayName = name?.trim() || email;
  const initials = getInitials(name, email);
  const inAdminArea = pathname?.startsWith('/admin') ?? false;

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
        <span className="account-menu-chevron" aria-hidden="true">
          <ChevronIcon />
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
              {isTemporaryOrgJoin ? (
                <span className="account-menu-temp-join">Testing this organisation</span>
              ) : null}
            </span>
          </li>
          <li role="none">
            <hr className="actions-menu-divider" />
          </li>
          {belongsToOrganization ? (
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
          ) : null}
          {isPlatformAdmin && !(inAdminArea && !belongsToOrganization) ? (
            <li role="none">
              <Link
                href={inAdminArea ? '/forms' : '/admin'}
                className="actions-menu-item"
                role="menuitem"
                onClick={() => setOpen(false)}
              >
                <span className="actions-menu-icon">
                  <ShieldIcon />
                </span>
                {inAdminArea ? (
                  <>
                    Log in to{' '}
                    <span className="account-menu-org-link">
                      {organizationName ?? 'the organisation'}
                    </span>
                  </>
                ) : (
                  <>
                    Return to <span className="account-menu-org-link">Clickforms Admin</span>
                  </>
                )}
              </Link>
            </li>
          ) : null}
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
