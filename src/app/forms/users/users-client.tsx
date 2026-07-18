'use client';

import type { UserRole } from '@prisma/client';
import { useCallback, useState } from 'react';
import { AddUserModal } from '@/app/forms/users/add-user-modal';
import { EditUserModal } from '@/app/forms/users/edit-user-modal';
import { RemoveUserModal } from '@/app/forms/users/remove-user-modal';
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

  async function copyInviteLink(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Invite link copied to clipboard');
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
      await copyInviteLink(data.inviteUrl);
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
        <button type="button" className="button" onClick={() => setAddModalOpen(true)}>
          Add user
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
        <table className="users-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Forms owned</th>
              <th>Assigned forms</th>
              <th>2FA</th>
              <th>Created at</th>
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
                        {user.name ?? '—'}
                        {isSelf ? (
                          <span className="badge badge--neutral users-you-badge">You</span>
                        ) : null}
                      </td>
                      <td>{user.email}</td>
                      <td>{formatUserRole(user.role)}</td>
                      <td>{user.formsOwned}</td>
                      <td>{user.assignedForms}</td>
                      <td className="users-table-muted">Off</td>
                      <td>{new Date(user.createdAt).toLocaleDateString('en-AU')}</td>
                      <td>
                        <div className="users-row-actions">
                          <button
                            type="button"
                            className="button button--ghost button--small"
                            onClick={() => setEditingUser(user)}
                          >
                            Edit
                          </button>
                          {!isSelf ? (
                            <button
                              type="button"
                              className="button button--ghost button--small users-row-action--danger"
                              onClick={() => setRemovingUser(user)}
                            >
                              Remove
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {pendingInvites.map((invite) => (
                  <tr key={invite.id} className="users-table-row--pending">
                    <td>{invite.name ?? '—'}</td>
                    <td>{invite.email}</td>
                    <td>
                      {formatUserRole(invite.role)}{' '}
                      <span className="badge badge--draft">Pending invite</span>
                    </td>
                    <td>—</td>
                    <td>—</td>
                    <td className="users-table-muted">—</td>
                    <td>{new Date(invite.createdAt).toLocaleDateString('en-AU')}</td>
                    <td>
                      <div className="users-row-actions">
                        <button
                          type="button"
                          className="button button--ghost button--small"
                          disabled={busyInviteId === invite.id}
                          onClick={() => void handleCopyInviteLink(invite.id)}
                        >
                          Copy link
                        </button>
                        <button
                          type="button"
                          className="button button--ghost button--small users-row-action--danger"
                          disabled={busyInviteId === invite.id}
                          onClick={() => void handleRevokeInvite(invite.id)}
                        >
                          Revoke
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </>
            )}
          </tbody>
        </table>
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
