'use client';

import type { UserRole } from '@prisma/client';
import { Fragment, type ReactNode, useCallback, useRef, useState } from 'react';
import { AddUserModal } from '@/app/forms/users/add-user-modal';
import { EditUserModal } from '@/app/forms/users/edit-user-modal';
import { RemoveUserModal } from '@/app/forms/users/remove-user-modal';
import { DropdownMenu } from '@/components/dropdown-menu';
import { useToast } from '@/components/toast';
import { readApiError } from '@/lib/error-message';
import { formatUserRole } from '@/lib/user-roles';

export interface UserRow {
  id: string;
  name: string | null;
  email: string;
  role: UserRole;
  formsOwned: number;
  assignedForms: number;
  createdAt: string;
}

export interface PendingInviteRow {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  expiresAt: string;
  createdAt: string;
}

interface UsersClientProps {
  currentUserId: string;
  initialUsers: UserRow[];
  initialPendingInvites: PendingInviteRow[];
}

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

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M7 2.5v9M2.5 7h9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function MoreIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="4" cy="8" r="1.2" fill="currentColor" />
      <circle cx="8" cy="8" r="1.2" fill="currentColor" />
      <circle cx="12" cy="8" r="1.2" fill="currentColor" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M10.5 2.5l3 3L5.5 13.5H2.5v-3L10.5 2.5z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function DeleteIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M3.5 4.5h9M6 4.5V3.5h4v1M5.5 4.5l.5 8h4l.5-8"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CopyLinkIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M6.7 9.3l2.6-2.6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path
        d="M7.5 4.3l1.2-1.2a2.3 2.3 0 0 1 3.3 3.3L10.8 7.6"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8.5 11.7l-1.2 1.2a2.3 2.3 0 0 1-3.3-3.3l1.2-1.2"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function RevokeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.4" />
      <line
        x1="4.5"
        y1="11.5"
        x2="11.5"
        y2="4.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function UserRowMenu({
  items,
}: {
  items: {
    label: string;
    icon: ReactNode;
    danger?: boolean;
    disabled?: boolean;
    onSelect: () => void;
  }[];
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  return (
    <div className="actions-menu">
      <button
        ref={triggerRef}
        type="button"
        className="users-row-menu-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Actions"
        onClick={() => setOpen((current) => !current)}
      >
        <MoreIcon />
      </button>
      <DropdownMenu open={open} onOpenChange={setOpen} triggerRef={triggerRef} align="end">
        {/* biome-ignore lint/a11y/noNoninteractiveElementToInteractiveRole: WAI-ARIA APG menu pattern, matches DropdownMenu's usage elsewhere in the app */}
        <ul role="menu">
          {items.map((item, index) => {
            const showDivider = Boolean(item.danger && index > 0 && !items[index - 1]?.danger);
            return (
              <Fragment key={item.label}>
                {showDivider ? (
                  <li role="none">
                    <hr className="actions-menu-divider" />
                  </li>
                ) : null}
                <li role="none">
                  <button
                    type="button"
                    role="menuitem"
                    className={
                      item.danger
                        ? 'actions-menu-item actions-menu-item--danger'
                        : 'actions-menu-item'
                    }
                    disabled={item.disabled}
                    onClick={() => {
                      setOpen(false);
                      item.onSelect();
                    }}
                  >
                    <span className="actions-menu-icon">{item.icon}</span>
                    {item.label}
                  </button>
                </li>
              </Fragment>
            );
          })}
        </ul>
      </DropdownMenu>
    </div>
  );
}

export function UsersClient({
  currentUserId,
  initialUsers,
  initialPendingInvites,
}: UsersClientProps) {
  const toast = useToast();
  const [users, setUsers] = useState(initialUsers);
  const [pendingInvites, setPendingInvites] = useState(initialPendingInvites);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const [removingUser, setRemovingUser] = useState<UserRow | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [busyInviteId, setBusyInviteId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const res = await fetch('/api/users');
    if (!res.ok) return;
    const data: { users: UserRow[]; pendingInvites: PendingInviteRow[] } = await res.json();
    setUsers(data.users);
    setPendingInvites(data.pendingInvites);
  }, []);

  async function copyInviteLink(url: string, options?: { alsoResent?: boolean }) {
    try {
      await navigator.clipboard.writeText(url);
      toast.success(
        options?.alsoResent
          ? 'Invite resent — link also copied to clipboard'
          : 'Invite link copied to clipboard',
      );
    } catch {
      toast.error('Could not copy link — select and copy manually');
    }
  }

  async function handleCopyInviteLink(inviteId: string) {
    setBusyInviteId(inviteId);
    try {
      const res = await fetch(`/api/users/invites/${inviteId}`);
      const data: { inviteUrl?: string; error?: string } = await res.json();
      if (!res.ok || !data.inviteUrl) {
        toast.error(data.error ?? 'Could not get invite link');
        return;
      }
      setInviteLink(data.inviteUrl);
      await copyInviteLink(data.inviteUrl, { alsoResent: true });
      void refresh();
    } catch {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setBusyInviteId(null);
    }
  }

  async function handleRevokeInvite(inviteId: string) {
    setBusyInviteId(inviteId);
    try {
      const res = await fetch(`/api/users/invites/${inviteId}`, { method: 'DELETE' });
      if (!res.ok) {
        toast.error(await readApiError(res, 'Could not revoke invite'));
        return;
      }
      toast.success('Invite revoked');
      void refresh();
    } catch {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setBusyInviteId(null);
    }
  }

  async function handleRemoveUser(transferFormsTo?: string) {
    if (!removingUser) return;
    setIsRemoving(true);
    try {
      const res = await fetch(`/api/users/${removingUser.id}`, {
        method: 'DELETE',
        ...(transferFormsTo
          ? {
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ transferFormsTo }),
            }
          : {}),
      });
      if (!res.ok) {
        toast.error(await readApiError(res, 'Could not remove user'));
        return;
      }
      toast.success('User removed');
      setRemovingUser(null);
      void refresh();
    } catch {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setIsRemoving(false);
    }
  }

  return (
    <div className="users-page">
      <div className="users-page-header">
        <div>
          <h1 className="users-page-title">Users</h1>
          <p className="users-page-subtitle">
            Give each of your staff their own login with different levels of access. Share the
            invite link with them after adding a user.
          </p>
        </div>
        <button type="button" className="button button--dark" onClick={() => setAddModalOpen(true)}>
          <PlusIcon /> Add user
        </button>
      </div>

      {inviteLink ? (
        <div className="card users-invite-banner">
          <p className="users-invite-banner-title">Invite link ready</p>
          <p className="users-invite-banner-text">
            Share this link with the new user. It expires in 7 days.
          </p>
          <div className="users-invite-link-row">
            <input
              className="text-input"
              readOnly
              value={inviteLink}
              onFocus={(event) => event.target.select()}
            />
            <button
              type="button"
              className="button button--secondary"
              onClick={() => void copyInviteLink(inviteLink)}
            >
              Copy link
            </button>
          </div>
          <button
            type="button"
            className="button button--ghost button--small"
            onClick={() => setInviteLink(null)}
          >
            Dismiss
          </button>
        </div>
      ) : null}

      <div className="card users-table-card">
        <div className="admin-table-scroll">
          <table className="users-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Forms owned</th>
                <th>Assigned</th>
                <th>2FA</th>
                <th>Created</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {users.length === 0 && pendingInvites.length === 0 ? (
                <tr>
                  <td colSpan={8} className="users-table-empty">
                    No users found.
                  </td>
                </tr>
              ) : (
                <>
                  {users.map((user) => {
                    const isSelf = user.id === currentUserId;
                    return (
                      <tr key={user.id}>
                        <td>
                          <span className="users-name-cell">
                            <span className="admin-table-avatar" aria-hidden="true">
                              {getInitials(user.name, user.email)}
                            </span>
                            <span className="users-name-text">{user.name ?? '—'}</span>
                            {isSelf ? (
                              <span className="badge badge--neutral users-you-badge">You</span>
                            ) : null}
                          </span>
                        </td>
                        <td>{user.email}</td>
                        <td>
                          <span className="users-role-pill">{formatUserRole(user.role)}</span>
                        </td>
                        <td>{user.formsOwned}</td>
                        <td>{user.assignedForms}</td>
                        <td>
                          <span className="users-2fa-pill">Off</span>
                        </td>
                        <td>{new Date(user.createdAt).toLocaleDateString('en-GB')}</td>
                        <td>
                          <UserRowMenu
                            items={[
                              {
                                label: 'Edit',
                                icon: <EditIcon />,
                                onSelect: () => setEditingUser(user),
                              },
                              ...(!isSelf
                                ? [
                                    {
                                      label: 'Remove',
                                      icon: <DeleteIcon />,
                                      danger: true,
                                      onSelect: () => setRemovingUser(user),
                                    },
                                  ]
                                : []),
                            ]}
                          />
                        </td>
                      </tr>
                    );
                  })}
                  {pendingInvites.map((invite) => (
                    <tr key={invite.id} className="users-table-row--pending">
                      <td>{invite.name ?? '—'}</td>
                      <td>{invite.email}</td>
                      <td>
                        <span className="users-role-pill">{formatUserRole(invite.role)}</span>{' '}
                        <span className="badge badge--draft">Pending invite</span>
                      </td>
                      <td>—</td>
                      <td>—</td>
                      <td className="users-table-muted">—</td>
                      <td>{new Date(invite.createdAt).toLocaleDateString('en-GB')}</td>
                      <td>
                        <UserRowMenu
                          items={[
                            {
                              label: 'Resend invite',
                              icon: <CopyLinkIcon />,
                              disabled: busyInviteId === invite.id,
                              onSelect: () => void handleCopyInviteLink(invite.id),
                            },
                            {
                              label: 'Revoke',
                              icon: <RevokeIcon />,
                              danger: true,
                              disabled: busyInviteId === invite.id,
                              onSelect: () => void handleRevokeInvite(invite.id),
                            },
                          ]}
                        />
                      </td>
                    </tr>
                  ))}
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AddUserModal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        onInvited={({ inviteUrl, email }) => {
          setInviteLink(inviteUrl);
          toast.success(`Invite created for ${email}`);
          void refresh();
        }}
      />

      <EditUserModal
        user={editingUser}
        isSelf={editingUser?.id === currentUserId}
        onClose={() => setEditingUser(null)}
        onSaved={() => {
          toast.success('User updated');
          void refresh();
        }}
      />

      <RemoveUserModal
        user={removingUser}
        otherUsers={users.filter((candidate) => candidate.id !== removingUser?.id)}
        isRemoving={isRemoving}
        onClose={() => !isRemoving && setRemovingUser(null)}
        onConfirm={(transferFormsTo) => void handleRemoveUser(transferFormsTo)}
      />
    </div>
  );
}
