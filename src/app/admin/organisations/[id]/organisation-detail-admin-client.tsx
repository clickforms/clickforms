'use client';

import type { OrgPlan, OrgStatus, UserRole } from '@prisma/client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type FormEvent, useCallback, useMemo, useRef, useState } from 'react';
import { InviteOrgUserModal } from '@/app/admin/organisations/[id]/invite-org-user-modal';
import {
  JoinOrganisationSession,
  useJoinOrganisation,
} from '@/app/admin/organisations/[id]/join-organisation-button';
import { DeleteOrganisationModal } from '@/app/admin/organisations/delete-organisation-modal';
import { DropdownMenu } from '@/components/dropdown-menu';
import { useToast } from '@/components/toast';
import { PLAN_LABELS } from '@/lib/admin/plan-limits';
import { readApiError } from '@/lib/error-message';
import { formatUserRole } from '@/lib/user-roles';

const STATUS_LABELS: Record<OrgStatus, string> = {
  active: 'Active',
  trial: 'Trial',
  suspended: 'Suspended',
};

export interface AdminOrgProfile {
  id: string;
  name: string;
  subdomain: string;
  abn: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  plan: OrgPlan;
  status: OrgStatus;
  createdAt: string;
}

export interface AdminOrgUser {
  id: string;
  name: string | null;
  email: string;
  role: UserRole;
  createdAt: string;
}

export interface AdminOrgPendingInvite {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  expiresAt: string;
  createdAt: string;
}

interface OrganisationDetailAdminClientProps {
  initialOrganization: AdminOrgProfile;
  initialUsers: AdminOrgUser[];
  initialPendingInvites: AdminOrgPendingInvite[];
  initialFormCount: number;
  initialSubmissionCount: number;
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

function PlusIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M8 3.5v9M3.5 8h9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M10 3.5 5.5 8 10 12.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

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

function OrgOverflowMenu({
  status,
  toggling,
  onToggleStatus,
  onDelete,
}: {
  status: OrgStatus;
  toggling: boolean;
  onToggleStatus: () => void;
  onDelete: () => void;
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
        aria-label="Organisation actions"
        disabled={toggling}
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
                onToggleStatus();
              }}
            >
              {status === 'suspended' ? 'Reactivate organisation' : 'Suspend organisation'}
            </button>
          </li>
          <li role="none">
            <hr className="actions-menu-divider" />
          </li>
          <li role="none">
            <button
              type="button"
              role="menuitem"
              className="actions-menu-item actions-menu-item--danger"
              onClick={() => {
                setOpen(false);
                onDelete();
              }}
            >
              Delete organisation
            </button>
          </li>
        </ul>
      </DropdownMenu>
    </div>
  );
}

function InviteRowMenu({
  busy,
  onResend,
  onRevoke,
}: {
  busy: boolean;
  onResend: () => void;
  onRevoke: () => void;
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
        aria-label="Invite actions"
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
                onResend();
              }}
            >
              Copy invite link
            </button>
          </li>
          <li role="none">
            <hr className="actions-menu-divider" />
          </li>
          <li role="none">
            <button
              type="button"
              role="menuitem"
              className="actions-menu-item actions-menu-item--danger"
              onClick={() => {
                setOpen(false);
                onRevoke();
              }}
            >
              Revoke invite
            </button>
          </li>
        </ul>
      </DropdownMenu>
    </div>
  );
}

function OrganisationDetailInner({
  initialOrganization,
  initialUsers,
  initialPendingInvites,
  initialFormCount,
  initialSubmissionCount,
}: OrganisationDetailAdminClientProps) {
  const toast = useToast();
  const router = useRouter();
  const [organization, setOrganization] = useState(initialOrganization);
  const [users, setUsers] = useState(initialUsers);
  const [pendingInvites, setPendingInvites] = useState(initialPendingInvites);

  const [name, setName] = useState(initialOrganization.name);
  const [abn, setAbn] = useState(initialOrganization.abn ?? '');
  const [contactName, setContactName] = useState(initialOrganization.contactName ?? '');
  const [contactEmail, setContactEmail] = useState(initialOrganization.contactEmail ?? '');
  const [contactPhone, setContactPhone] = useState(initialOrganization.contactPhone ?? '');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [busyInviteId, setBusyInviteId] = useState<string | null>(null);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isTogglingStatus, setIsTogglingStatus] = useState(false);

  const { access, isJoining, isLeaving, currentUserId, join, leave } = useJoinOrganisation(
    organization.id,
    organization.name,
  );

  const isDirty = useMemo(() => {
    return (
      name.trim() !== organization.name ||
      abn.trim() !== (organization.abn ?? '') ||
      contactName.trim() !== (organization.contactName ?? '') ||
      contactEmail.trim() !== (organization.contactEmail ?? '') ||
      contactPhone.trim() !== (organization.contactPhone ?? '')
    );
  }, [name, abn, contactName, contactEmail, contactPhone, organization]);

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/admin/organizations/${organization.id}`);
    if (!res.ok) return;
    const data: {
      organization: AdminOrgProfile;
      users: AdminOrgUser[];
      pendingInvites: AdminOrgPendingInvite[];
    } = await res.json();
    setOrganization(data.organization);
    setUsers(data.users);
    setPendingInvites(data.pendingInvites);
  }, [organization.id]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Organisation name is required');
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch(`/api/admin/organizations/${organization.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: trimmedName,
          abn: abn.trim(),
          contactName: contactName.trim(),
          contactEmail: contactEmail.trim(),
          contactPhone: contactPhone.trim(),
        }),
      });

      if (!res.ok) {
        setError(await readApiError(res, 'Could not save organisation details'));
        return;
      }

      const data: { organization: AdminOrgProfile } = await res.json();
      setOrganization(data.organization);
      setName(data.organization.name);
      setAbn(data.organization.abn ?? '');
      setContactName(data.organization.contactName ?? '');
      setContactEmail(data.organization.contactEmail ?? '');
      setContactPhone(data.organization.contactPhone ?? '');
      toast.success('Organisation details saved');
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }

  async function copyInviteLink(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Invite link copied');
    } catch {
      toast.error('Could not copy link — select and copy it below');
    }
  }

  async function handleCopyInviteLink(inviteId: string) {
    setBusyInviteId(inviteId);
    try {
      const res = await fetch(`/api/admin/organizations/${organization.id}/invites/${inviteId}`);
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
      const res = await fetch(`/api/admin/organizations/${organization.id}/invites/${inviteId}`, {
        method: 'DELETE',
      });
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

  async function handleToggleStatus() {
    const nextStatus: OrgStatus = organization.status === 'suspended' ? 'active' : 'suspended';
    setIsTogglingStatus(true);
    try {
      const res = await fetch(`/api/admin/organizations/${organization.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!res.ok) {
        toast.error(await readApiError(res, 'Could not update organisation status'));
        return;
      }
      const data: { organization: AdminOrgProfile } = await res.json();
      setOrganization(data.organization);
      toast.success(
        nextStatus === 'suspended' ? 'Organisation suspended' : 'Organisation reactivated',
      );
    } catch {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setIsTogglingStatus(false);
    }
  }

  async function handleDeleteConfirm() {
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/admin/organizations/${organization.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        throw new Error(await readApiError(res, 'Failed to delete organisation'));
      }
      toast.success('Organisation deleted');
      router.push('/admin/organisations');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete organisation');
      setIsDeleting(false);
    }
  }

  const stats = [
    { label: 'Users', value: users.length },
    { label: 'Pending invites', value: pendingInvites.length },
    { label: 'Forms', value: initialFormCount },
    { label: 'Responses', value: initialSubmissionCount },
  ];

  return (
    <div className="admin-org-detail">
      <Link href="/admin/organisations" className="admin-org-back">
        <ChevronIcon /> Organisations
      </Link>

      <header className="admin-org-header">
        <div className="admin-org-identity">
          <div className="admin-org-mark" aria-hidden="true">
            {getInitials(organization.name, organization.subdomain)}
          </div>
          <div>
            <div className="admin-org-title-row">
              <h1 className="admin-org-title">{organization.name}</h1>
              <span className={`admin-org-status admin-org-status--${organization.status}`}>
                {STATUS_LABELS[organization.status]}
              </span>
            </div>
            <p className="admin-org-meta">
              {organization.subdomain}
              <span aria-hidden="true"> · </span>
              {PLAN_LABELS[organization.plan]}
              <span aria-hidden="true"> · </span>
              Created {formatDate(organization.createdAt)}
            </p>
          </div>
        </div>

        <div className="admin-org-header-actions">
          {access === 'member' ? (
            <>
              <Link href="/forms" className="button button--dark">
                Open workspace
              </Link>
              <button
                type="button"
                className="button button--ghost"
                disabled={isLeaving}
                onClick={() => {
                  void leave().then((ok) => {
                    if (ok) void refresh();
                  });
                }}
              >
                {isLeaving ? 'Leaving…' : 'Leave organisation'}
              </button>
            </>
          ) : (
            <>
              {access === 'blocked' ? (
                <button
                  type="button"
                  className="button button--ghost"
                  disabled={isLeaving}
                  onClick={() => {
                    void leave().then((ok) => {
                      if (ok) void refresh();
                    });
                  }}
                >
                  {isLeaving ? 'Leaving…' : 'Leave current organisation'}
                </button>
              ) : null}
              <button
                type="button"
                className="button button--dark"
                disabled={access !== 'ready' || isJoining}
                title={access === 'blocked' ? 'Leave your current organisation first' : undefined}
                onClick={() => void join()}
              >
                {isJoining ? 'Joining…' : 'Join organisation'}
              </button>
            </>
          )}
          <OrgOverflowMenu
            status={organization.status}
            toggling={isTogglingStatus}
            onToggleStatus={() => void handleToggleStatus()}
            onDelete={() => setDeleteOpen(true)}
          />
        </div>
      </header>

      {access === 'member' ? (
        <p className="admin-org-banner">
          You are in this organisation as Clickforms staff. Leave when you are finished so you
          don&apos;t keep editing customer data by accident.
        </p>
      ) : access === 'blocked' ? (
        <p className="admin-org-banner admin-org-banner--muted">
          You are already in another organisation. Leave that one before joining this one.
        </p>
      ) : null}

      <section className="admin-org-stats" aria-label="Organisation snapshot">
        {stats.map((stat) => (
          <div key={stat.label} className="admin-org-stat">
            <span className="admin-org-stat-value">{stat.value}</span>
            <span className="admin-org-stat-label">{stat.label}</span>
          </div>
        ))}
      </section>

      <section className="admin-org-panel">
        <div className="admin-org-panel-header">
          <div>
            <h2 className="admin-org-panel-title">People</h2>
            <p className="admin-org-panel-copy">Members and outstanding invites.</p>
          </div>
          <button
            type="button"
            className="button button--dark"
            onClick={() => setInviteModalOpen(true)}
          >
            <PlusIcon /> Invite user
          </button>
        </div>

        {inviteLink ? (
          <div className="admin-org-invite-link">
            <div>
              <p className="admin-org-invite-link-title">Invite link ready</p>
              <p className="admin-org-invite-link-copy">Share this with the person you invited.</p>
            </div>
            <div className="admin-org-invite-link-row">
              <input
                className="text-input"
                readOnly
                value={inviteLink}
                onFocus={(event) => event.target.select()}
              />
              <button
                type="button"
                className="button button--ghost"
                onClick={() => void copyInviteLink(inviteLink)}
              >
                Copy
              </button>
              <button
                type="button"
                className="button button--ghost"
                onClick={() => setInviteLink(null)}
              >
                Dismiss
              </button>
            </div>
          </div>
        ) : null}

        {users.length === 0 && pendingInvites.length === 0 ? (
          <p className="admin-org-empty">No people in this organisation yet.</p>
        ) : (
          <ul className="admin-org-people">
            {users.map((user) => (
              <li key={user.id} className="admin-org-person">
                <span className="admin-org-person-avatar" aria-hidden="true">
                  {getInitials(user.name, user.email)}
                </span>
                <span className="admin-org-person-copy">
                  <span className="admin-org-person-name">{user.name ?? user.email}</span>
                  <span className="admin-org-person-meta">{user.email}</span>
                </span>
                <span className="admin-org-person-role">{formatUserRole(user.role)}</span>
                {user.id === currentUserId && access === 'member' ? (
                  <button
                    type="button"
                    className="button button--ghost admin-org-person-leave"
                    disabled={isLeaving}
                    onClick={() => {
                      void leave().then((ok) => {
                        if (ok) void refresh();
                      });
                    }}
                  >
                    {isLeaving ? 'Leaving…' : 'Remove me'}
                  </button>
                ) : (
                  <time className="admin-org-person-time" dateTime={user.createdAt}>
                    {formatDate(user.createdAt)}
                  </time>
                )}
              </li>
            ))}
            {pendingInvites.map((invite) => (
              <li key={invite.id} className="admin-org-person admin-org-person--pending">
                <span className="admin-org-person-avatar" aria-hidden="true">
                  {getInitials(invite.name, invite.email)}
                </span>
                <span className="admin-org-person-copy">
                  <span className="admin-org-person-name">{invite.name ?? invite.email}</span>
                  <span className="admin-org-person-meta">
                    {invite.email} · Invite expires {formatDate(invite.expiresAt)}
                  </span>
                </span>
                <span className="admin-org-person-role">
                  {formatUserRole(invite.role)}
                  <span className="admin-org-pending-pill">Pending</span>
                </span>
                <InviteRowMenu
                  busy={busyInviteId === invite.id}
                  onResend={() => void handleCopyInviteLink(invite.id)}
                  onRevoke={() => void handleRevokeInvite(invite.id)}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="admin-org-panel">
        <div className="admin-org-panel-header">
          <div>
            <h2 className="admin-org-panel-title">Details</h2>
            <p className="admin-org-panel-copy">Name, billing identity, and who to contact.</p>
          </div>
        </div>

        <form className="admin-org-form" onSubmit={handleSubmit}>
          {error ? (
            <p className="form-error" role="alert">
              {error}
            </p>
          ) : null}

          <div className="admin-org-fields">
            <label className="admin-org-field">
              <span>Organisation name</span>
              <input
                className="text-input"
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
                disabled={isSaving}
              />
            </label>
            <label className="admin-org-field">
              <span>Subdomain</span>
              <input className="text-input" value={organization.subdomain} readOnly />
            </label>
            <label className="admin-org-field">
              <span>ABN</span>
              <input
                className="text-input"
                value={abn}
                onChange={(event) => setAbn(event.target.value)}
                placeholder="Optional"
                inputMode="numeric"
                disabled={isSaving}
              />
            </label>
            <label className="admin-org-field">
              <span>Contact person</span>
              <input
                className="text-input"
                value={contactName}
                onChange={(event) => setContactName(event.target.value)}
                placeholder="Optional"
                disabled={isSaving}
              />
            </label>
            <label className="admin-org-field">
              <span>Contact email</span>
              <input
                className="text-input"
                type="email"
                value={contactEmail}
                onChange={(event) => setContactEmail(event.target.value)}
                placeholder="Optional"
                disabled={isSaving}
              />
            </label>
            <label className="admin-org-field">
              <span>Contact phone</span>
              <input
                className="text-input"
                type="tel"
                value={contactPhone}
                onChange={(event) => setContactPhone(event.target.value)}
                placeholder="Optional"
                disabled={isSaving}
              />
            </label>
          </div>

          <div className="admin-org-form-actions">
            <button type="submit" className="button button--dark" disabled={isSaving || !isDirty}>
              {isSaving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </form>
      </section>

      <section className="admin-org-danger">
        <div>
          <h2 className="admin-org-panel-title">Delete organisation</h2>
          <p className="admin-org-panel-copy">
            Removes users, forms, responses, and files. This cannot be undone.
          </p>
        </div>
        <button
          type="button"
          className="button button--ghost-danger"
          onClick={() => setDeleteOpen(true)}
        >
          Delete organisation
        </button>
      </section>

      <InviteOrgUserModal
        open={inviteModalOpen}
        organizationId={organization.id}
        onClose={() => setInviteModalOpen(false)}
        onInvited={({ inviteUrl, email }) => {
          setInviteLink(inviteUrl);
          toast.success(`Invite created for ${email}`);
          void refresh();
        }}
      />

      <DeleteOrganisationModal
        open={deleteOpen}
        organizationName={organization.name}
        userCount={users.length}
        formCount={initialFormCount}
        isDeleting={isDeleting}
        onClose={() => !isDeleting && setDeleteOpen(false)}
        onConfirm={() => void handleDeleteConfirm()}
      />
    </div>
  );
}

export function OrganisationDetailAdminClient(props: OrganisationDetailAdminClientProps) {
  return (
    <JoinOrganisationSession>
      <OrganisationDetailInner {...props} />
    </JoinOrganisationSession>
  );
}
