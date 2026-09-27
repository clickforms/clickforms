'use client';

import type { PlatformAdminRole } from '@prisma/client';
import { useMemo, useRef, useState } from 'react';
import { InviteTeamMemberModal } from '@/app/admin/team/invite-team-member-modal';
import { DropdownMenu } from '@/components/dropdown-menu';
import { useToast } from '@/components/toast';
import { PLATFORM_ADMIN_ROLE_LABELS } from '@/lib/admin/platform-admin-roles';
import { readApiError } from '@/lib/error-message';

const TEAM_FILTERS = ['all', 'super_admin', 'support', 'pending'] as const;
type TeamFilter = (typeof TEAM_FILTERS)[number];

const TEAM_FILTER_LABELS: Record<TeamFilter, string> = {
  all: 'All',
  super_admin: 'Super admins',
  support: 'Support',
  pending: 'Pending',
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

function PlusIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M8 3.5v9M3.5 8h9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
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

function TeamRowMenu({
  label,
  busy,
  items,
}: {
  label: string;
  busy: boolean;
  items: { label: string; danger?: boolean; onSelect: () => void }[];
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
        aria-label={`Actions for ${label}`}
        disabled={busy}
        onClick={() => setOpen((current) => !current)}
      >
        <MoreIcon />
      </button>
      <DropdownMenu open={open} onOpenChange={setOpen} triggerRef={triggerRef} align="end">
        {/* biome-ignore lint/a11y/noNoninteractiveElementToInteractiveRole: WAI-ARIA APG menu pattern, matches DropdownMenu's usage elsewhere in the app */}
        <ul role="menu">
          {items.map((item) => (
            <li key={item.label} role="none">
              <button
                type="button"
                role="menuitem"
                className={
                  item.danger ? 'actions-menu-item actions-menu-item--danger' : 'actions-menu-item'
                }
                onClick={() => {
                  setOpen(false);
                  item.onSelect();
                }}
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      </DropdownMenu>
    </div>
  );
}

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
  const [admins, setAdmins] = useState(initialAdmins);
  const [pendingInvites, setPendingInvites] = useState(initialPendingInvites);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [busyInviteId, setBusyInviteId] = useState<string | null>(null);
  const [busyAdminId, setBusyAdminId] = useState<string | null>(null);
  const [teamFilter, setTeamFilter] = useState<TeamFilter>('all');

  const filterCounts = useMemo(() => {
    const counts: Record<TeamFilter, number> = {
      all: admins.length + pendingInvites.length,
      super_admin: 0,
      support: 0,
      pending: pendingInvites.length,
    };
    for (const admin of admins) {
      if (admin.role === 'super_admin') counts.super_admin += 1;
      if (admin.role === 'support') counts.support += 1;
    }
    return counts;
  }, [admins, pendingInvites]);

  const visibleAdmins = useMemo(() => {
    if (teamFilter === 'pending') return [];
    if (teamFilter === 'all') return admins;
    return admins.filter((admin) => admin.role === teamFilter);
  }, [admins, teamFilter]);

  const visibleInvites = useMemo(() => {
    if (teamFilter === 'super_admin' || teamFilter === 'support') return [];
    return pendingInvites;
  }, [pendingInvites, teamFilter]);

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

  async function handleRemoveAdmin(admin: PlatformAdminRow) {
    if (admin.isSelf) return;
    setBusyAdminId(admin.id);
    try {
      const res = await fetch(`/api/admin/team/${admin.id}`, { method: 'DELETE' });
      if (!res.ok) {
        toast.error(await readApiError(res, 'Could not remove team member'));
        return;
      }
      setAdmins((current) => current.filter((row) => row.id !== admin.id));
      toast.success(`${admin.name ?? admin.email} removed from the team`);
    } catch {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setBusyAdminId(null);
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
    <div className="admin-orgs admin-orgs-directory admin-users-directory">
      <header className="admin-orgs-header">
        <div>
          <h1 className="admin-orgs-title">Team</h1>
          <p className="admin-orgs-lead">
            Clickforms staff who can access admin across every organisation.
          </p>
        </div>
        <button
          type="button"
          className="button button--dark"
          onClick={() => setInviteModalOpen(true)}
        >
          <PlusIcon /> Invite platform admin
        </button>
      </header>

      {admins.length + pendingInvites.length > 0 ? (
        <section className="admin-orgs-directory-stats" aria-label="Team snapshot">
          {TEAM_FILTERS.map((filter) => (
            <button
              key={filter}
              type="button"
              className={`admin-orgs-directory-stat${
                teamFilter === filter ? ' admin-orgs-directory-stat--active' : ''
              }${filter === 'pending' && filterCounts.pending > 0 ? ' admin-orgs-directory-stat--alert' : ''}`}
              onClick={() => setTeamFilter(filter)}
            >
              <span className="admin-orgs-directory-stat-value">{filterCounts[filter]}</span>
              <span className="admin-orgs-directory-stat-label">
                {TEAM_FILTER_LABELS[filter]}
                {filter === 'pending' && filterCounts.pending > 0 ? (
                  <span className="admin-orgs-directory-stat-note">Needs review</span>
                ) : null}
              </span>
            </button>
          ))}
        </section>
      ) : null}

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

      <div className="card admin-orgs-card">
        <div className="admin-table-scroll">
          <table className="admin-orgs-table">
            <thead>
              <tr>
                <th>Member</th>
                <th>Permission</th>
                <th>Joined</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleAdmins.length === 0 && visibleInvites.length === 0 ? (
                <tr>
                  <td colSpan={4} className="admin-table-empty">
                    {admins.length + pendingInvites.length === 0
                      ? 'No platform admins yet.'
                      : 'No team members match that filter.'}
                  </td>
                </tr>
              ) : (
                <>
                  {visibleAdmins.map((admin) => (
                    <tr key={admin.id}>
                      <td data-label="Member">
                        <span className="admin-orgs-directory-identity">
                          <span className="admin-orgs-directory-mark" aria-hidden="true">
                            {getInitials(admin.name, admin.email)}
                          </span>
                          <span className="admin-orgs-directory-copy">
                            <span className="admin-home-org-name-row">
                              <span className="admin-orgs-name">
                                {admin.name ?? 'Unnamed admin'}
                              </span>
                              {admin.isSelf ? (
                                <span className="badge badge--neutral">You</span>
                              ) : null}
                            </span>
                            <span className="admin-orgs-directory-subdomain">{admin.email}</span>
                          </span>
                        </span>
                      </td>
                      <td data-label="Permission">
                        <span className="users-role-pill">
                          {PLATFORM_ADMIN_ROLE_LABELS[admin.role]}
                        </span>
                      </td>
                      <td data-label="Joined">{formatDate(admin.createdAt)}</td>
                      <td data-label="Actions">
                        {admin.isSelf ? (
                          <span className="admin-templates-facet-empty">—</span>
                        ) : (
                          <TeamRowMenu
                            label={admin.name ?? admin.email}
                            busy={busyAdminId === admin.id}
                            items={[
                              {
                                label: 'Remove from team',
                                danger: true,
                                onSelect: () => void handleRemoveAdmin(admin),
                              },
                            ]}
                          />
                        )}
                      </td>
                    </tr>
                  ))}
                  {visibleInvites.map((invite) => (
                    <tr key={invite.id} className="users-table-row--pending">
                      <td data-label="Member">
                        <span className="admin-orgs-directory-identity">
                          <span className="admin-orgs-directory-mark" aria-hidden="true">
                            {getInitials(invite.name, invite.email)}
                          </span>
                          <span className="admin-orgs-directory-copy">
                            <span className="admin-orgs-name">
                              {invite.name ?? 'Invited admin'}
                            </span>
                            <span className="admin-orgs-directory-subdomain">{invite.email}</span>
                          </span>
                        </span>
                      </td>
                      <td data-label="Permission">
                        <span className="users-role-pill">
                          {PLATFORM_ADMIN_ROLE_LABELS[invite.role]}
                        </span>{' '}
                        <span className="badge badge--draft">Pending</span>
                      </td>
                      <td data-label="Joined">Invited {formatDate(invite.createdAt)}</td>
                      <td data-label="Actions">
                        <TeamRowMenu
                          label={invite.name ?? invite.email}
                          busy={busyInviteId === invite.id}
                          items={[
                            {
                              label: 'Resend invite',
                              onSelect: () => void handleCopyInviteLink(invite.id),
                            },
                            {
                              label: 'Revoke invite',
                              danger: true,
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
        <div className="admin-orgs-footer">
          <span>
            {visibleAdmins.length + visibleInvites.length}{' '}
            {visibleAdmins.length + visibleInvites.length === 1 ? 'member' : 'members'}
          </span>
        </div>
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
