'use client';

import type { OrgPlan, OrgStatus } from '@prisma/client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useRef, useState } from 'react';
import { DeleteOrganisationModal } from '@/app/admin/organisations/delete-organisation-modal';
import { DropdownMenu } from '@/components/dropdown-menu';
import { useToast } from '@/components/toast';
import { PLAN_LABELS } from '@/lib/admin/plan-limits';
import { readApiError } from '@/lib/error-message';

export interface OrganizationRow {
  id: string;
  name: string;
  subdomain: string;
  plan: OrgPlan;
  status: OrgStatus;
  createdAt: string;
  userCount: number;
  formCount: number;
}

const STATUS_FILTERS = ['all', 'active', 'trial', 'suspended'] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

const STATUS_FILTER_LABELS: Record<StatusFilter, string> = {
  all: 'All',
  active: 'Active',
  trial: 'Trial',
  suspended: 'Suspended',
};

const STATUS_LABELS: Record<OrgStatus, string> = {
  active: 'Active',
  trial: 'Trial',
  suspended: 'Suspended',
};

function SearchIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="7" cy="7" r="4.6" stroke="currentColor" strokeWidth="1.4" />
      <path d="M13 13l-2.5-2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
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

function PauseIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path d="M4 2.5v7M8 2.5v7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path d="M4 2.4 9.2 6 4 9.6V2.4Z" fill="currentColor" />
    </svg>
  );
}

function SortIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
      <path
        d="M2 3.2 5 1.4 8 3.2M2 6.8 5 8.6 8 6.8"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
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

function OrgRowMenu({
  org,
  busy,
  onOpen,
  onDelete,
}: {
  org: OrganizationRow;
  busy: boolean;
  onOpen: () => void;
  onDelete: () => void;
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
        aria-label={`More actions for ${org.name}`}
        disabled={busy}
        onClick={(event) => {
          event.stopPropagation();
          setOpen((current) => !current);
        }}
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
                onOpen();
              }}
            >
              Open
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
              Delete
            </button>
          </li>
        </ul>
      </DropdownMenu>
    </div>
  );
}

export function OrganisationsListClient({
  initialOrganizations,
}: {
  initialOrganizations: OrganizationRow[];
}) {
  const [organizations, setOrganizations] = useState(initialOrganizations);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [createdDir, setCreatedDir] = useState<'desc' | 'asc'>('desc');
  const [deletingOrg, setDeletingOrg] = useState<OrganizationRow | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [busyOrgId, setBusyOrgId] = useState<string | null>(null);
  const router = useRouter();
  const toast = useToast();

  const statusCounts = useMemo(() => {
    const counts: Record<StatusFilter, number> = {
      all: organizations.length,
      active: 0,
      trial: 0,
      suspended: 0,
    };
    for (const org of organizations) {
      counts[org.status] += 1;
    }
    return counts;
  }, [organizations]);

  const visibleOrganizations = useMemo(() => {
    const term = search.trim().toLowerCase();
    const filtered = organizations.filter((org) => {
      if (statusFilter !== 'all' && org.status !== statusFilter) return false;
      if (!term) return true;
      return org.name.toLowerCase().includes(term) || org.subdomain.toLowerCase().includes(term);
    });
    return [...filtered].sort((a, b) => {
      const delta = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      return createdDir === 'desc' ? -delta : delta;
    });
  }, [organizations, search, statusFilter, createdDir]);

  async function handleToggleStatus(org: OrganizationRow) {
    const nextStatus: OrgStatus = org.status === 'suspended' ? 'active' : 'suspended';
    setBusyOrgId(org.id);
    try {
      const response = await fetch(`/api/admin/organizations/${org.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!response.ok) {
        throw new Error(await readApiError(response, 'Could not update organisation status'));
      }
      setOrganizations((current) =>
        current.map((row) => (row.id === org.id ? { ...row, status: nextStatus } : row)),
      );
      toast.success(
        nextStatus === 'suspended' ? 'Organisation suspended' : 'Organisation reactivated',
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not update organisation status');
    } finally {
      setBusyOrgId(null);
    }
  }

  async function handleDeleteConfirm() {
    if (!deletingOrg) return;
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/admin/organizations/${deletingOrg.id}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error(await readApiError(response, 'Failed to delete organisation'));
      }
      setOrganizations((current) => current.filter((org) => org.id !== deletingOrg.id));
      toast.success('Organisation deleted');
      setDeletingOrg(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete organisation');
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="admin-orgs">
      <header className="admin-orgs-header">
        <div>
          <h1 className="admin-orgs-title">Organisations</h1>
          <p className="admin-orgs-lead">Every organisation on the platform.</p>
        </div>
        <Link href="/admin/organisations/new" className="button button--dark">
          <PlusIcon /> New organisation
        </Link>
      </header>

      {deletingOrg ? (
        <DeleteOrganisationModal
          open
          organizationName={deletingOrg.name}
          userCount={deletingOrg.userCount}
          formCount={deletingOrg.formCount}
          isDeleting={isDeleting}
          onClose={() => !isDeleting && setDeletingOrg(null)}
          onConfirm={() => void handleDeleteConfirm()}
        />
      ) : null}

      {organizations.length === 0 ? (
        <section className="admin-home-empty">
          <div>
            <h2 className="admin-home-empty-title">No organisations yet</h2>
            <p className="admin-home-empty-copy">
              Create the first customer organisation and invite its admin to set a password.
            </p>
            <Link href="/admin/organisations/new" className="button button--dark">
              <PlusIcon /> New organisation
            </Link>
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
                placeholder="Search organisations..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                aria-label="Search organisations"
              />
            </label>
            <div className="admin-orgs-chips" role="tablist" aria-label="Filter by status">
              {STATUS_FILTERS.map((filter) => (
                <button
                  key={filter}
                  type="button"
                  className={`admin-orgs-chip${statusFilter === filter ? ' admin-orgs-chip--active' : ''}`}
                  onClick={() => setStatusFilter(filter)}
                >
                  {STATUS_FILTER_LABELS[filter]} {statusCounts[filter]}
                </button>
              ))}
            </div>
          </div>
          <div className="admin-table-scroll">
            <table className="admin-orgs-table">
              <thead>
                <tr>
                  <th>Organisation</th>
                  <th>Plan</th>
                  <th>Users</th>
                  <th>Forms</th>
                  <th>Status</th>
                  <th>
                    <button
                      type="button"
                      className="admin-orgs-sort"
                      onClick={() =>
                        setCreatedDir((current) => (current === 'desc' ? 'asc' : 'desc'))
                      }
                    >
                      Created
                      <SortIcon />
                    </button>
                  </th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleOrganizations.map((org) => {
                  const detailHref = `/admin/organisations/${org.id}`;
                  return (
                    // biome-ignore lint/a11y/useSemanticElements: must stay a <tr> for correct table semantics — role="button" + tabIndex + onKeyDown supply the missing button affordance instead of nesting a real <button> around table cells
                    <tr
                      key={org.id}
                      className="forms-row--clickable"
                      role="button"
                      tabIndex={0}
                      onClick={() => router.push(detailHref)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          router.push(detailHref);
                        }
                      }}
                    >
                      <td data-label="Organisation">
                        <span className="admin-orgs-name">{org.name}</span>
                      </td>
                      <td data-label="Plan">
                        <span className={`admin-orgs-plan admin-orgs-plan--${org.plan}`}>
                          {PLAN_LABELS[org.plan]}
                        </span>
                      </td>
                      <td data-label="Users">{org.userCount}</td>
                      <td data-label="Forms">{org.formCount}</td>
                      <td data-label="Status">
                        <span className={`admin-orgs-status admin-orgs-status--${org.status}`}>
                          <span className="admin-orgs-status-dot" aria-hidden="true" />
                          {STATUS_LABELS[org.status]}
                        </span>
                      </td>
                      <td data-label="Created">
                        {new Date(org.createdAt).toLocaleDateString('en-AU')}
                      </td>
                      <td
                        data-label="Actions"
                        onClick={(event) => event.stopPropagation()}
                        onKeyDown={(event) => event.stopPropagation()}
                      >
                        <div className="admin-orgs-actions">
                          <button
                            type="button"
                            className={`admin-orgs-status-action${
                              org.status === 'suspended' ? ' admin-orgs-status-action--resume' : ''
                            }`}
                            disabled={busyOrgId === org.id}
                            onClick={() => void handleToggleStatus(org)}
                          >
                            {org.status === 'suspended' ? <PlayIcon /> : <PauseIcon />}
                            {org.status === 'suspended' ? 'Reactivate' : 'Suspend'}
                          </button>
                          <OrgRowMenu
                            org={org}
                            busy={busyOrgId === org.id}
                            onOpen={() => router.push(detailHref)}
                            onDelete={() => setDeletingOrg(org)}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {visibleOrganizations.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="admin-table-empty">
                      No organisations match that search.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <div className="admin-orgs-footer">
            <span>
              {visibleOrganizations.length}{' '}
              {visibleOrganizations.length === 1 ? 'organisation' : 'organisations'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
