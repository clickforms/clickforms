'use client';

import type { PlatformAdminRole } from '@prisma/client';
import { useState } from 'react';
import { InviteTeamMemberModal } from '@/app/admin/team/invite-team-member-modal';
import { useToast } from '@/components/toast';
import { PLATFORM_ADMIN_ROLE_LABELS } from '@/lib/admin/platform-admin-roles';
import { readApiError } from '@/lib/error-message';

export interface PlatformAdminRow {
  id: string;
  name: string | null;
  email: string;
  role: PlatformAdminRole;
  createdAt: string;
  isSelf: boolean;
}

export interface PendingTeamInvite {
  id: string;
  email: string;
  name: string | null;
  role: PlatformAdminRole;
  createdAt: string;
  expiresAt: string;
}

export function TeamAdminClient({
  initialAdmins,
  initialPendingInvites,
}: {
  initialAdmins: PlatformAdminRow[];
  initialPendingInvites: PendingTeamInvite[];
}) {
  const toast = useToast();
  const [admins] = useState(initialAdmins);
  const [pendingInvites, setPendingInvites] = useState(initialPendingInvites);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [busyInviteId, setBusyInviteId] = useState<string | null>(null);

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
      const res = await fetch(`/api/admin/team/invites/${inviteId}`);
      const data: { inviteUrl?: string; error?: string } = await res.json();
      if (!res.ok || !data.inviteUrl) {
        toast.error(data.error ?? 'Could not get invite link');
        return;
      }
      setInviteLink(data.inviteUrl);
      await copyInviteLink(data.inviteUrl, { alsoResent: true });
    } catch {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setBusyInviteId(null);
    }
  }

  async function handleRevokeInvite(inviteId: string) {
    setBusyInviteId(inviteId);
    try {
      const res = await fetch(`/api/admin/team/invites/${inviteId}`, { method: 'DELETE' });
      if (!res.ok) {
        toast.error(await readApiError(res, 'Could not revoke invite'));
        return;
      }
      toast.success('Invite revoked');
      setPendingInvites((current) => current.filter((invite) => invite.id !== inviteId));
    } catch {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setBusyInviteId(null);
    }
  }

  return (
    <div className="settings-page">
      <header className="settings-page-header">
        <div className="users-page-header">
          <div>
            <h1 className="settings-page-title">Team</h1>
            <p className="settings-page-lead">
              Clickforms staff who can access /admin across every organisation.
            </p>
          </div>
          <button type="button" className="button" onClick={() => setInviteModalOpen(true)}>
            Invite platform admin
          </button>
        </div>
      </header>

      {inviteLink ? (
        <div className="card users-invite-banner">
          <p className="users-invite-banner-title">Invite link ready</p>
          <p className="users-invite-banner-text">
            Share this link with the invited platform admin.
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
              <th>Permission level</th>
              <th>Joined</th>
              <th aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {admins.length === 0 && pendingInvites.length === 0 ? (
              <tr>
                <td colSpan={5} className="users-table-empty">
                  No platform admins yet.
                </td>
              </tr>
            ) : (
              <>
                {admins.map((admin) => (
                  <tr key={admin.id}>
                    <td>
                      {admin.name ?? '—'}{' '}
                      {admin.isSelf ? <span className="badge badge--neutral">You</span> : null}
                    </td>
                    <td>{admin.email}</td>
                    <td>{PLATFORM_ADMIN_ROLE_LABELS[admin.role]}</td>
                    <td>{new Date(admin.createdAt).toLocaleDateString('en-AU')}</td>
                    <td />
                  </tr>
                ))}
                {pendingInvites.map((invite) => (
                  <tr key={invite.id} className="users-table-row--pending">
                    <td>{invite.name ?? '—'}</td>
                    <td>{invite.email}</td>
                    <td>
                      {PLATFORM_ADMIN_ROLE_LABELS[invite.role]}{' '}
                      <span className="badge badge--draft">Pending invite</span>
                    </td>
                    <td>{new Date(invite.createdAt).toLocaleDateString('en-AU')}</td>
                    <td>
                      <div className="users-row-actions">
                        <button
                          type="button"
                          className="button button--ghost button--small"
                          disabled={busyInviteId === invite.id}
                          onClick={() => void handleCopyInviteLink(invite.id)}
                        >
                          Resend invite
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

      <InviteTeamMemberModal
        open={inviteModalOpen}
        onClose={() => setInviteModalOpen(false)}
        onInvited={({ inviteId, inviteUrl, email, name, role, expiresAt }) => {
          setInviteLink(inviteUrl);
          setPendingInvites((current) => [
            {
              id: inviteId,
              email,
              name: name || null,
              role,
              createdAt: new Date().toISOString(),
              expiresAt,
            },
            ...current.filter((invite) => invite.email !== email),
          ]);
          toast.success(`Invite created for ${email}`);
        }}
      />
    </div>
  );
}
