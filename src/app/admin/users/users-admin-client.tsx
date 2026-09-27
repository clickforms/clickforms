'use client';

import type { UserRole } from '@prisma/client';
import Link from 'next/link';
import { useMemo, useRef, useState } from 'react';
import { DropdownMenu } from '@/components/dropdown-menu';
import { useToast } from '@/components/toast';
import { extractApiError, readApiError } from '@/lib/error-message';
import { formatUserRole } from '@/lib/user-roles';

export interface PlatformUserRow {
  id: string;
  name: string | null;
  email: string;
  role: UserRole;
  twoFactorEnabled: boolean;
  createdAt: string;
  organizationId: string | null;
  organizationName: string;
}

const USER_FILTERS = ['all', 'admin', 'member', 'twoFactorOff'] as const;
type UserFilter = (typeof USER_FILTERS)[number];

const USER_FILTER_LABELS: Record<UserFilter, string> = {
  all: 'All',
  admin: 'Super admins',
  member: 'Org users',
  twoFactorOff: '2FA off',
};

function getInitials(name: string | null, email: string): string {
  const source = name?.trim() || email;
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : (parts[0]?.[1] ?? '');
  return `${first}${last}`.toUpperCase();
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function SearchIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="7" cy="7" r="4.6" stroke="currentColor" strokeWidth="1.4" />
      <path d="M13 13l-2.5-2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function MoreIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="3.25" r="1.15" fill="currentColor" />
      <circle cx="8" cy="8" r="1.15" fill="currentColor" />
      <circle cx="8" cy="12.75" r="1.15" fill="currentColor" />
    </svg>
  );
}

function UserRowMenu({
  user,
  busy,
  onResetPassword,
  onResetTwoFactor,
}: {
  user: PlatformUserRow;
  busy: boolean;
  onResetPassword: () => void;
  onResetTwoFactor: () => void;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  return (
    <div className="actions-menu">
      <button
        ref={triggerRef}
        type="button"
        className="admin-orgs-more"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Actions for ${user.email}`}
        disabled={busy}
        onClick={() => setOpen((current) => !current)}
      >
        <MoreIcon />
      </button>
      <DropdownMenu open={open} onOpenChange={setOpen} triggerRef={triggerRef} align="end">
        {/* biome-ignore lint/a11y/noNoninteractiveElementToInteractiveRole: WAI-ARIA APG menu pattern, matches DropdownMenu's usage elsewhere in the app */}
        <ul role="menu">
          <li role="none">
            <button
              type="button"
              role="menuitem"
              className="actions-menu-item"
              onClick={() => {
                setOpen(false);
                onResetPassword();
              }}
            >
              Reset password
            </button>
          </li>
          <li role="none">
            <button
              type="button"
              role="menuitem"
              className={`actions-menu-item${user.twoFactorEnabled ? '' : ' actions-menu-item--disabled'}`}
              disabled={!user.twoFactorEnabled}
              onClick={() => {
                if (!user.twoFactorEnabled) return;
                setOpen(false);
                onResetTwoFactor();
              }}
            >
              Reset 2FA
            </button>
          </li>
        </ul>
      </DropdownMenu>
    </div>
  );
}

export function UsersAdminClient({ initialUsers }: { initialUsers: PlatformUserRow[] }) {
  const [users, setUsers] = useState(initialUsers);
  const [search, setSearch] = useState('');
  const [userFilter, setUserFilter] = useState<UserFilter>('all');
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [resetLink, setResetLink] = useState<string | null>(null);
  const toast = useToast();

  const filterCounts = useMemo(() => {
    const counts: Record<UserFilter, number> = {
      all: users.length,
      admin: 0,
      member: 0,
      twoFactorOff: 0,
    };
    for (const user of users) {
      if (user.role === 'admin') counts.admin += 1;
      if (user.role === 'member') counts.member += 1;
      if (!user.twoFactorEnabled) counts.twoFactorOff += 1;
    }
    return counts;
  }, [users]);

  const visibleUsers = useMemo(() => {
    const term = search.trim().toLowerCase();
    return users.filter((user) => {
      if (userFilter === 'admin' && user.role !== 'admin') return false;
      if (userFilter === 'member' && user.role !== 'member') return false;
      if (userFilter === 'twoFactorOff' && user.twoFactorEnabled) return false;
      if (!term) return true;
      return (
        (user.name ?? '').toLowerCase().includes(term) ||
        user.email.toLowerCase().includes(term) ||
        user.organizationName.toLowerCase().includes(term)
      );
    });
  }, [users, search, userFilter]);

  async function copyResetLink(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Reset email sent — link copied');
    } catch {
      toast.success('Reset email sent');
    }
  }

  async function handleResetPassword(user: PlatformUserRow) {
    setBusyUserId(user.id);
    try {
      const response = await fetch(`/api/admin/users/${user.id}/reset-password`, {
        method: 'POST',
      });
      const data: { resetUrl?: string; error?: string } = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(extractApiError(data, 'Could not send a password reset'));
      }
      if (data.resetUrl) {
        setResetLink(data.resetUrl);
        await copyResetLink(data.resetUrl);
      } else {
        toast.success(`Password reset emailed to ${user.email}`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not send a password reset');
    } finally {
      setBusyUserId(null);
    }
  }

  async function handleResetTwoFactor(user: PlatformUserRow) {
    setBusyUserId(user.id);
    try {
      const response = await fetch(`/api/admin/users/${user.id}/reset-2fa`, { method: 'POST' });
      if (!response.ok) {
        throw new Error(await readApiError(response, 'Could not reset two-factor authentication'));
      }
      setUsers((current) =>
        current.map((row) => (row.id === user.id ? { ...row, twoFactorEnabled: false } : row)),
      );
      toast.success(`Two-factor authentication reset for ${user.email}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not reset two-factor authentication');
    } finally {
      setBusyUserId(null);
    }
  }

  return (
    <div className="admin-orgs admin-orgs-directory admin-users-directory">
      <header className="admin-orgs-header">
        <div>
          <h1 className="admin-orgs-title">Users</h1>
          <p className="admin-orgs-lead">Every user across every organisation.</p>
        </div>
      </header>

      {users.length > 0 ? (
        <section className="admin-orgs-directory-stats" aria-label="User snapshot">
          {USER_FILTERS.map((filter) => (
            <button
              key={filter}
              type="button"
              className={`admin-orgs-directory-stat${
                userFilter === filter ? ' admin-orgs-directory-stat--active' : ''
              }${filter === 'twoFactorOff' && filterCounts.twoFactorOff > 0 ? ' admin-orgs-directory-stat--alert' : ''}`}
              onClick={() => setUserFilter(filter)}
            >
              <span className="admin-orgs-directory-stat-value">{filterCounts[filter]}</span>
              <span className="admin-orgs-directory-stat-label">
                {USER_FILTER_LABELS[filter]}
                {filter === 'twoFactorOff' && filterCounts.twoFactorOff > 0 ? (
                  <span className="admin-orgs-directory-stat-note">Needs review</span>
                ) : null}
              </span>
            </button>
          ))}
        </section>
      ) : null}

      {users.length === 0 ? (
        <section className="admin-home-empty">
          <div>
            <h2 className="admin-home-empty-title">No users yet</h2>
            <p className="admin-home-empty-copy">
              Users appear here once organisations have members.
            </p>
          </div>
        </section>
      ) : (
        <div className="card admin-orgs-card">
          <div className="admin-orgs-toolbar">
            <label className="admin-orgs-search">
              <span className="admin-orgs-search-icon">
                <SearchIcon />
              </span>
              <input
                type="text"
                placeholder="Search users..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                aria-label="Search users"
              />
            </label>
          </div>

          {resetLink ? (
            <div className="admin-users-reset-link">
              <p className="admin-users-reset-link-title">Password reset link ready</p>
              <div className="admin-org-invite-link-row">
                <input
                  className="text-input"
                  readOnly
                  value={resetLink}
                  onFocus={(event) => event.target.select()}
                />
                <button
                  type="button"
                  className="button button--ghost"
                  onClick={() => void copyResetLink(resetLink)}
                >
                  Copy
                </button>
                <button
                  type="button"
                  className="button button--ghost"
                  onClick={() => setResetLink(null)}
                >
                  Dismiss
                </button>
              </div>
            </div>
          ) : null}

          <div className="admin-table-scroll">
            <table className="admin-orgs-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Organisation</th>
                  <th>Role</th>
                  <th>2FA</th>
                  <th>Joined</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleUsers.map((user) => (
                  <tr key={user.id}>
                    <td data-label="User">
                      <span className="admin-orgs-directory-identity">
                        <span className="admin-orgs-directory-mark" aria-hidden="true">
                          {getInitials(user.name, user.email)}
                        </span>
                        <span className="admin-orgs-directory-copy">
                          <span className="admin-orgs-name">{user.name ?? 'Unnamed user'}</span>
                          <span className="admin-orgs-directory-subdomain">{user.email}</span>
                        </span>
                      </span>
                    </td>
                    <td data-label="Organisation">
                      {user.organizationId ? (
                        <Link
                          href={`/admin/organisations/${user.organizationId}`}
                          className="admin-users-org-link"
                        >
                          {user.organizationName}
                        </Link>
                      ) : (
                        user.organizationName
                      )}
                    </td>
                    <td data-label="Role">
                      <span className="users-role-pill">{formatUserRole(user.role)}</span>
                    </td>
                    <td data-label="2FA">
                      <span
                        className={`admin-users-2fa ${
                          user.twoFactorEnabled ? 'admin-users-2fa--on' : 'admin-users-2fa--off'
                        }`}
                      >
                        <span className="admin-orgs-status-dot" aria-hidden="true" />
                        {user.twoFactorEnabled ? 'On' : 'Off'}
                      </span>
                    </td>
                    <td data-label="Joined">{formatDate(user.createdAt)}</td>
                    <td data-label="Actions">
                      <div className="admin-orgs-actions">
                        <UserRowMenu
                          user={user}
                          busy={busyUserId === user.id}
                          onResetPassword={() => void handleResetPassword(user)}
                          onResetTwoFactor={() => void handleResetTwoFactor(user)}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
                {visibleUsers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="admin-table-empty">
                      No users match that search.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <div className="admin-orgs-footer">
            <span>
              {visibleUsers.length} {visibleUsers.length === 1 ? 'user' : 'users'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
