'use client';

import type { FormStatus } from '@prisma/client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { DeleteFormModal } from '@/app/forms/delete-form-modal';
import { FormActionsMenu } from '@/app/forms/form-actions-menu';
import { TransferFormModal } from '@/app/forms/transfer-form-modal';
import { DropdownMenu } from '@/components/dropdown-menu';
import { LiveStatusBadge } from '@/components/live-status-badge';
import { useToast } from '@/components/toast';
import { readApiError } from '@/lib/error-message';
import { type FormWorkflowAction, runFormWorkflow } from '@/lib/forms/form-workflow-client';

type ViewMode = 'list' | 'grid';

interface FormSummary {
  id: string;
  name: string;
  slug: string;
  status: FormStatus;
  updatedAt: string;
  createdAt: string;
  responseCount: number;
  /** Absolute URL on the org's subdomain, e.g. https://carecircle.clickforms.com.au/f/intake-form. */
  publicUrl: string;
  /** Creator's user id, for the transfer-ownership picker. */
  createdById: string;
  /** Creator's name, falling back to email — see src/app/forms/list/page.tsx. */
  createdByName: string;
  /** Whether the signed-in user is this form's creator — only they can toggle privacy. */
  isOwnForm: boolean;
  /** Opt-out flag: hidden from everyone but the creator when true (see formsListWhere). */
  isPrivate: boolean;
  /** The version currently served to respondents, if any — see src/lib/forms/live-status.ts. */
  currentVersionId: string | null;
}

interface OrgMember {
  id: string;
  name: string;
}

type SortColumn = 'name' | 'createdAt' | 'updatedAt' | 'responseCount' | 'status';
type SortDirection = 'asc' | 'desc';
type StatusFilter = 'all' | 'live' | 'draft';

const COLUMNS: { key: SortColumn; label: string }[] = [
  { key: 'name', label: 'Form name' },
  { key: 'createdAt', label: 'Created' },
  { key: 'updatedAt', label: 'Last updated' },
  { key: 'responseCount', label: 'Responses' },
  { key: 'status', label: 'Status' },
];

const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'live', label: 'Live' },
  { key: 'draft', label: 'Draft' },
];

const PAGE_SIZE = 10;

function SearchIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="7" cy="7" r="4.6" stroke="currentColor" strokeWidth="1.4" />
      <path d="M13 13l-2.5-2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path
        d="M2.5 2.5l7 7M9.5 2.5l-7 7"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path
        d="M2.5 6.3 5 8.8l4.5-5.1"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SortIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M4.5 2.5v10M4.5 2.5 2 5M4.5 2.5 7 5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9 5.5h5M9 8.5h3.5M9 11.5h2"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function FilterIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M2 3.2h12L9.6 8v5l-3.2 1.4V8L2 3.2z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ListViewIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="2.6" cy="4" r="0.9" fill="currentColor" />
      <circle cx="2.6" cy="8" r="0.9" fill="currentColor" />
      <circle cx="2.6" cy="12" r="0.9" fill="currentColor" />
      <path
        d="M5.6 4h7.9M5.6 8h7.9M5.6 12h7.9"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  );
}

function GridViewIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="2" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3" />
      <rect x="9" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3" />
      <rect x="2" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3" />
      <rect x="9" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}

function ChevronLeftIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path
        d="M8.5 3 4 7l4.5 4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path
        d="M5.5 3 10 7l-4.5 4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// "Moses Buta" -> "MB", single-word names fall back to their first two letters.
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : (parts[0]?.[1] ?? '');
  return `${first}${last}`.toUpperCase();
}

function isFormLive(form: FormSummary): boolean {
  return form.currentVersionId !== null && form.status !== 'archived';
}

function matchesStatusFilter(form: FormSummary, filter: StatusFilter): boolean {
  if (filter === 'all') return true;
  if (form.status === 'archived') return false;
  if (filter === 'live') return isFormLive(form);
  return !isFormLive(form);
}

function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatRelativeTime(iso: string): string {
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatShortDate(iso);
}

export function FormsListClient({
  initialForms,
  canEdit,
  currentUserDisplayName,
  orgMembers,
}: {
  initialForms: FormSummary[];
  canEdit: boolean;
  /** Falls back to this label for the creator of a form just-duplicated by the current user. */
  currentUserDisplayName: string;
  /** Every org member, for the transfer-ownership picker. */
  orgMembers: OrgMember[];
}) {
  const [forms, setForms] = useState(initialForms);
  const [search, setSearch] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const toast = useToast();
  const router = useRouter();
  const [sortColumn, setSortColumn] = useState<SortColumn>('updatedAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [deletingForm, setDeletingForm] = useState<FormSummary | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [transferringForm, setTransferringForm] = useState<FormSummary | null>(null);
  const [isTransferring, setIsTransferring] = useState(false);
  const [page, setPage] = useState(1);

  // Toolbar: search/sort/filter collapse into icon buttons (search opens an inline field,
  // sort/filter open a dropdown) rather than the always-visible search box + chip row, plus
  // a List/Grid layout switch — the table itself is unchanged, Grid is an alternate card
  // layout over the same filtered/sorted `visibleForms`/`pageForms` below.
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isSortMenuOpen, setIsSortMenuOpen] = useState(false);
  const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const sortTriggerRef = useRef<HTMLButtonElement>(null);
  const filterTriggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isSearchOpen) searchInputRef.current?.focus();
  }, [isSearchOpen]);

  async function handleCopyLink(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Live link copied to clipboard');
    } catch {
      toast.error('Could not copy link — select and copy manually');
    }
  }

  async function handleRename(id: string) {
    const name = renameValue.trim();
    setRenamingId(null);
    if (!name) return;

    const previous = forms;
    setForms((current) => current.map((f) => (f.id === id ? { ...f, name } : f)));

    const response = await fetch(`/api/forms/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    if (!response.ok) {
      setForms(previous);
      toast.error(await readApiError(response, 'Failed to rename form'));
    }
  }

  async function handleDuplicate(form: FormSummary) {
    try {
      const response = await fetch(`/api/forms/${form.id}/duplicate`, { method: 'POST' });
      if (!response.ok) {
        throw new Error(await readApiError(response, 'Failed to duplicate form'));
      }
      const { form: newForm } = await response.json();
      setForms((current) => [
        {
          id: newForm.id,
          name: newForm.name,
          slug: newForm.slug,
          status: newForm.status,
          updatedAt: newForm.updatedAt,
          createdAt: newForm.createdAt,
          responseCount: 0,
          publicUrl: newForm.publicUrl,
          // The duplicating user is always the new form's creator, and it starts visible
          // to the org (isPrivate defaults false) — matches what POST /api/forms/[id]/duplicate
          // actually persists.
          createdById: newForm.createdBy,
          createdByName: currentUserDisplayName,
          isOwnForm: true,
          isPrivate: false,
          // A duplicate always starts as an unpublished draft — never live.
          currentVersionId: null,
        },
        ...current,
      ]);
      toast.success('Form duplicated');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to duplicate form');
    }
  }

  async function handleTogglePrivate(form: FormSummary) {
    const isPrivate = !form.isPrivate;
    const previous = forms;
    setForms((current) => current.map((f) => (f.id === form.id ? { ...f, isPrivate } : f)));

    const response = await fetch(`/api/forms/${form.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isPrivate }),
    });
    if (!response.ok) {
      setForms(previous);
      toast.error(await readApiError(response, 'Failed to update form visibility'));
      return;
    }
    toast.success(isPrivate ? 'Form is now private to you' : 'Form is now visible to the org');
  }

  async function handleToggleArchive(form: FormSummary) {
    const archived = form.status !== 'archived';
    const previous = forms;
    setForms((current) =>
      current.map((f) =>
        f.id === form.id ? { ...f, status: archived ? 'archived' : f.status } : f,
      ),
    );

    const response = await fetch(`/api/forms/${form.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ archived }),
    });
    if (!response.ok) {
      setForms(previous);
      toast.error(await readApiError(response, 'Failed to update form status'));
      return;
    }
    const { form: updated } = await response.json();
    setForms((current) =>
      current.map((f) => (f.id === form.id ? { ...f, status: updated.status } : f)),
    );
    toast.success(archived ? 'Form archived' : 'Form restored');
  }

  async function handleWorkflow(form: FormSummary, action: FormWorkflowAction) {
    const previous = forms;
    try {
      const body = await runFormWorkflow(form.id, action);
      setForms((current) =>
        current.map((entry) =>
          entry.id === form.id
            ? {
                ...entry,
                status: body.form.status as FormStatus,
                currentVersionId: body.form.currentVersionId,
              }
            : entry,
        ),
      );

      const messages: Record<FormWorkflowAction, string> = {
        publish: 'Form published',
        unpublish: 'Form taken offline',
      };
      toast.success(messages[action]);
    } catch (err) {
      setForms(previous);
      toast.error(err instanceof Error ? err.message : 'Failed to update form status');
    }
  }

  async function handleDeleteConfirm() {
    if (!deletingForm) return;

    setIsDeleting(true);
    const previous = forms;
    setForms((current) => current.filter((entry) => entry.id !== deletingForm.id));

    try {
      const response = await fetch(`/api/forms/${deletingForm.id}`, { method: 'DELETE' });
      if (!response.ok) {
        throw new Error(await readApiError(response, 'Failed to delete form'));
      }
      toast.success('Form deleted');
      setDeletingForm(null);
    } catch (err) {
      setForms(previous);
      toast.error(err instanceof Error ? err.message : 'Failed to delete form');
    } finally {
      setIsDeleting(false);
    }
  }

  async function handleTransferConfirm(newOwnerId: string) {
    if (!transferringForm) return;

    setIsTransferring(true);
    try {
      const response = await fetch(`/api/forms/${transferringForm.id}/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newOwnerId }),
      });
      if (!response.ok) {
        throw new Error(await readApiError(response, 'Failed to transfer form'));
      }
      const { form: updatedForm, newOwnerName } = await response.json();
      setForms((current) =>
        current.map((f) =>
          f.id === transferringForm.id
            ? {
                ...f,
                createdById: updatedForm.createdBy,
                createdByName: newOwnerName,
                isOwnForm: false,
              }
            : f,
        ),
      );
      toast.success(`Ownership transferred to ${newOwnerName}`);
      setTransferringForm(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to transfer form');
    } finally {
      setIsTransferring(false);
    }
  }

  function toggleSort(column: SortColumn) {
    if (column === sortColumn) {
      setSortDirection((direction) => (direction === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  }

  const visibleForms = useMemo(() => {
    const term = search.trim().toLowerCase();
    const filtered = forms.filter((form) => {
      if (!matchesStatusFilter(form, statusFilter)) return false;
      if (!term) return true;
      return form.name.toLowerCase().includes(term) || form.slug.toLowerCase().includes(term);
    });

    return [...filtered].sort((a, b) => {
      let result = 0;
      switch (sortColumn) {
        case 'name':
          result = a.name.localeCompare(b.name);
          break;
        case 'createdAt':
          result = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
        case 'updatedAt':
          result = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
          break;
        case 'responseCount':
          result = a.responseCount - b.responseCount;
          break;
        case 'status':
          result = a.status.localeCompare(b.status);
          break;
      }
      return sortDirection === 'asc' ? result : -result;
    });
  }, [forms, search, statusFilter, sortColumn, sortDirection]);

  // Jump back to page 1 whenever the search/sort narrows or reorders the list — otherwise
  // a page number that used to be valid could land past the end of a smaller result set.
  // biome-ignore lint/correctness/useExhaustiveDependencies: deps intentionally trigger a reset even though the effect body doesn't read them
  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, sortColumn, sortDirection]);

  const totalPages = Math.max(1, Math.ceil(visibleForms.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageForms = visibleForms.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const filterCounts = useMemo(() => {
    const counts: Record<StatusFilter, number> = { all: 0, live: 0, draft: 0 };
    for (const form of forms) {
      counts.all += 1;
      if (matchesStatusFilter(form, 'live')) counts.live += 1;
      if (matchesStatusFilter(form, 'draft')) counts.draft += 1;
    }
    return counts;
  }, [forms]);

  return (
    <div className="forms-list-page">
      <header className="forms-list-header">
        <div>
          <h1 className="settings-page-title">Forms</h1>
          <p className="settings-page-lead">
            Create, publish, and manage the forms in this organisation.
          </p>
        </div>
      </header>

      {deletingForm ? (
        <DeleteFormModal
          open
          formName={deletingForm.name}
          responseCount={deletingForm.responseCount}
          isDeleting={isDeleting}
          onClose={() => !isDeleting && setDeletingForm(null)}
          onConfirm={() => void handleDeleteConfirm()}
        />
      ) : null}

      {transferringForm ? (
        <TransferFormModal
          open
          formName={transferringForm.name}
          members={orgMembers.filter((member) => member.id !== transferringForm.createdById)}
          isTransferring={isTransferring}
          onClose={() => !isTransferring && setTransferringForm(null)}
          onConfirm={(newOwnerId) => void handleTransferConfirm(newOwnerId)}
        />
      ) : null}

      {forms.length === 0 ? (
        <div className="card empty-state">
          <p className="empty-state-title">No forms yet</p>
          <p>Create a form to start collecting responses.</p>
          {canEdit ? (
            <Link href="/forms/templates" className="button button--dark">
              + New form
            </Link>
          ) : null}
        </div>
      ) : (
        <div className="card admin-table-card">
          <div className="forms-toolbar">
            <div className="forms-toolbar-icons">
              {isSearchOpen ? (
                <label className="forms-search forms-search--inline">
                  <span className="forms-search-icon">
                    <SearchIcon />
                  </span>
                  <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Search forms…"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key !== 'Escape') return;
                      if (search) {
                        setSearch('');
                      } else {
                        setIsSearchOpen(false);
                      }
                    }}
                    onBlur={() => {
                      if (!search) setIsSearchOpen(false);
                    }}
                    aria-label="Search forms"
                  />
                  {search ? (
                    <button
                      type="button"
                      className="forms-search-clear"
                      aria-label="Clear search"
                      onClick={() => {
                        setSearch('');
                        setIsSearchOpen(false);
                      }}
                    >
                      <CloseIcon />
                    </button>
                  ) : null}
                </label>
              ) : (
                <button
                  type="button"
                  className="forms-toolbar-icon-btn"
                  aria-label="Search forms"
                  onClick={() => setIsSearchOpen(true)}
                >
                  <SearchIcon />
                </button>
              )}

              <button
                ref={sortTriggerRef}
                type="button"
                className="forms-toolbar-icon-btn"
                aria-label="Sort forms"
                aria-haspopup="menu"
                onClick={() => setIsSortMenuOpen((current) => !current)}
              >
                <SortIcon />
              </button>
              <DropdownMenu
                open={isSortMenuOpen}
                onOpenChange={setIsSortMenuOpen}
                triggerRef={sortTriggerRef}
                align="start"
              >
                {/* biome-ignore lint/a11y/noNoninteractiveElementToInteractiveRole: WAI-ARIA APG menu pattern, matches DropdownMenu's usage elsewhere in the app */}
                <ul role="menu">
                  {COLUMNS.map((column) => (
                    <li role="none" key={column.key}>
                      <button
                        type="button"
                        role="menuitem"
                        className="actions-menu-item"
                        onClick={() => {
                          toggleSort(column.key);
                          setIsSortMenuOpen(false);
                        }}
                      >
                        <span className="actions-menu-icon actions-menu-check">
                          {sortColumn === column.key ? <CheckIcon /> : null}
                        </span>
                        <span className="actions-menu-item-text">{column.label}</span>
                        {sortColumn === column.key ? (
                          <span className="table-sort-indicator">
                            {sortDirection === 'asc' ? '▲' : '▼'}
                          </span>
                        ) : null}
                      </button>
                    </li>
                  ))}
                </ul>
              </DropdownMenu>

              <button
                ref={filterTriggerRef}
                type="button"
                className={`forms-toolbar-icon-btn${statusFilter !== 'all' ? ' forms-toolbar-icon-btn--active' : ''}`}
                aria-label="Filter forms"
                aria-haspopup="menu"
                onClick={() => setIsFilterMenuOpen((current) => !current)}
              >
                <FilterIcon />
              </button>
              <DropdownMenu
                open={isFilterMenuOpen}
                onOpenChange={setIsFilterMenuOpen}
                triggerRef={filterTriggerRef}
                align="start"
              >
                {/* biome-ignore lint/a11y/noNoninteractiveElementToInteractiveRole: WAI-ARIA APG menu pattern, matches DropdownMenu's usage elsewhere in the app */}
                <ul role="menu">
                  {STATUS_FILTERS.map((filter) => (
                    <li role="none" key={filter.key}>
                      <button
                        type="button"
                        role="menuitem"
                        className="actions-menu-item"
                        onClick={() => {
                          setStatusFilter(filter.key);
                          setIsFilterMenuOpen(false);
                        }}
                      >
                        <span className="actions-menu-icon actions-menu-check">
                          {statusFilter === filter.key ? <CheckIcon /> : null}
                        </span>
                        <span className="actions-menu-item-text">{filter.label}</span>
                        <span className="forms-filter-chip-count">{filterCounts[filter.key]}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </DropdownMenu>

              <div className="forms-view-toggle" role="tablist" aria-label="Layout">
                <button
                  type="button"
                  role="tab"
                  aria-selected={viewMode === 'list'}
                  className={`forms-view-toggle-btn${viewMode === 'list' ? ' forms-view-toggle-btn--active' : ''}`}
                  onClick={() => setViewMode('list')}
                >
                  <ListViewIcon />
                  List
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={viewMode === 'grid'}
                  className={`forms-view-toggle-btn${viewMode === 'grid' ? ' forms-view-toggle-btn--active' : ''}`}
                  onClick={() => setViewMode('grid')}
                >
                  <GridViewIcon />
                  Grid
                </button>
              </div>
            </div>
            {canEdit ? (
              <Link href="/forms/templates" className="button button--dark">
                + New form
              </Link>
            ) : null}
          </div>
          {viewMode === 'grid' ? (
            <div className="forms-grid">
              {pageForms.map((form) => (
                <FormsGridCard
                  key={form.id}
                  form={form}
                  canEdit={canEdit}
                  renamingId={renamingId}
                  renameValue={renameValue}
                  onRenameValueChange={setRenameValue}
                  onRenameSubmit={() => handleRename(form.id)}
                  onRenameCancel={() => setRenamingId(null)}
                  onNavigate={() => router.push(`/forms/${form.id}/builder`)}
                  onCopyLink={() => void handleCopyLink(form.publicUrl)}
                  onWorkflow={(action) => handleWorkflow(form, action)}
                  onRename={() => {
                    setRenamingId(form.id);
                    setRenameValue(form.name);
                  }}
                  onDuplicate={() => handleDuplicate(form)}
                  onToggleArchive={() => handleToggleArchive(form)}
                  onDelete={() => setDeletingForm(form)}
                  onTogglePrivate={() => handleTogglePrivate(form)}
                  onTransfer={() => setTransferringForm(form)}
                />
              ))}
              {visibleForms.length === 0 ? (
                <div className="admin-table-empty forms-grid-empty">
                  {search.trim()
                    ? `No forms match "${search.trim()}".`
                    : 'No forms in this filter.'}
                </div>
              ) : null}
            </div>
          ) : (
            <div className="admin-table-scroll">
              <table className="admin-table forms-table">
                <thead>
                  <tr>
                    {COLUMNS.map((column) => (
                      <th key={column.key}>
                        <button
                          type="button"
                          className="table-sort-button"
                          onClick={() => toggleSort(column.key)}
                        >
                          {column.label}
                          {sortColumn === column.key ? (
                            <span className="table-sort-indicator">
                              {sortDirection === 'asc' ? '▲' : '▼'}
                            </span>
                          ) : null}
                        </button>
                      </th>
                    ))}
                    <th className="forms-table-static-header">Created by</th>
                    <th className="forms-table-static-header">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pageForms.map((form) => {
                    const isLive = isFormLive(form);
                    const builderHref = `/forms/${form.id}/builder`;
                    const responsesHref = `/forms/${form.id}/submissions`;
                    const updatedLabel = formatRelativeTime(form.updatedAt);
                    return (
                      // biome-ignore lint/a11y/useSemanticElements: must stay a <tr> for correct table semantics — role="button" + tabIndex + onKeyDown supply the missing button affordance instead of nesting a real <button> around table cells
                      <tr
                        key={form.id}
                        className="forms-row--clickable"
                        role="button"
                        tabIndex={0}
                        onClick={() => router.push(builderHref)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            router.push(builderHref);
                          }
                        }}
                      >
                        <td
                          data-label="Form name"
                          onClick={(event) => event.stopPropagation()}
                          onKeyDown={(event) => event.stopPropagation()}
                        >
                          {renamingId === form.id ? (
                            <input
                              className="text-input"
                              value={renameValue}
                              // biome-ignore lint/a11y/noAutofocus: user just clicked "rename" — focusing the field they're about to type into is the expected behavior
                              autoFocus
                              onChange={(event) => setRenameValue(event.target.value)}
                              onBlur={() => handleRename(form.id)}
                              onKeyDown={(event) => {
                                if (event.key === 'Enter') handleRename(form.id);
                                if (event.key === 'Escape') setRenamingId(null);
                              }}
                            />
                          ) : (
                            <Link href={builderHref} className="admin-table-name-link">
                              {form.name}
                            </Link>
                          )}
                        </td>
                        <td
                          data-label="Created"
                          title={new Date(form.createdAt).toLocaleString('en-AU')}
                        >
                          {formatShortDate(form.createdAt)}
                        </td>
                        <td
                          data-label="Last updated"
                          title={new Date(form.updatedAt).toLocaleString('en-AU')}
                        >
                          {updatedLabel}
                        </td>
                        <td
                          data-label="Responses"
                          onClick={(event) => event.stopPropagation()}
                          onKeyDown={(event) => event.stopPropagation()}
                        >
                          <Link href={responsesHref} className="forms-responses-link">
                            {form.responseCount}
                          </Link>
                        </td>
                        <td data-label="Status">
                          <LiveStatusBadge status={form.status} isLive={isLive} />
                        </td>
                        <td data-label="Created by">
                          <span className="admin-table-creator">
                            <span className="admin-table-avatar" aria-hidden="true">
                              {getInitials(form.createdByName)}
                            </span>
                            {form.createdByName}
                          </span>
                          {form.isPrivate ? (
                            <span className="badge badge--neutral admin-table-private-badge">
                              Private
                            </span>
                          ) : null}
                        </td>
                        <td
                          data-label="Actions"
                          onClick={(event) => event.stopPropagation()}
                          onKeyDown={(event) => event.stopPropagation()}
                        >
                          <div className="forms-row-actions">
                            {canEdit && form.status === 'archived' ? (
                              <button
                                type="button"
                                className="button button--small button--ghost"
                                onClick={() => void handleToggleArchive(form)}
                              >
                                Restore
                              </button>
                            ) : canEdit && !isLive && form.status !== 'archived' ? (
                              <button
                                type="button"
                                className="button button--small button--success"
                                onClick={() => void handleWorkflow(form, 'publish')}
                              >
                                Publish
                              </button>
                            ) : isLive ? (
                              <button
                                type="button"
                                className="button button--small button--ghost"
                                onClick={() => void handleCopyLink(form.publicUrl)}
                              >
                                Share
                              </button>
                            ) : (
                              <Link
                                href={builderHref}
                                className="button button--small button--ghost"
                              >
                                {canEdit ? 'Edit' : 'View'}
                              </Link>
                            )}
                            <FormActionsMenu
                              formId={form.id}
                              formUrl={form.publicUrl}
                              status={form.status}
                              isLive={isLive}
                              canEdit={canEdit}
                              onRename={() => {
                                setRenamingId(form.id);
                                setRenameValue(form.name);
                              }}
                              onDuplicate={() => handleDuplicate(form)}
                              onToggleArchive={() => handleToggleArchive(form)}
                              onWorkflow={(action) => handleWorkflow(form, action)}
                              onDelete={() => setDeletingForm(form)}
                              isPrivate={form.isPrivate}
                              isOwnForm={form.isOwnForm}
                              onTogglePrivate={() => handleTogglePrivate(form)}
                              onTransfer={() => setTransferringForm(form)}
                              onCopyLink={() => void handleCopyLink(form.publicUrl)}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {visibleForms.length === 0 ? (
                    <tr>
                      <td colSpan={COLUMNS.length + 2} className="admin-table-empty">
                        {search.trim()
                          ? `No forms match “${search.trim()}”.`
                          : 'No forms in this filter.'}
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          )}

          <div className="forms-pagination">
            <span>
              {visibleForms.length} {visibleForms.length === 1 ? 'form' : 'forms'} · Page{' '}
              {currentPage} of {totalPages}
            </span>
            <div className="forms-pagination-controls">
              <button
                type="button"
                className="forms-pagination-button"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={currentPage <= 1}
                aria-label="Previous page"
              >
                <ChevronLeftIcon />
              </button>
              <button
                type="button"
                className="forms-pagination-button"
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                disabled={currentPage >= totalPages}
                aria-label="Next page"
              >
                <ChevronRightIcon />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Grid-view counterpart to a `<tr>` in the table above — same data, same actions (via the
 *  same FormActionsMenu), same click-through-to-builder and inline-rename behavior, just
 *  laid out as a card. Kept in this file rather than split out since it's tightly coupled
 *  to FormsListClient's state (renaming, all the mutation handlers). */
function FormsGridCard({
  form,
  canEdit,
  renamingId,
  renameValue,
  onRenameValueChange,
  onRenameSubmit,
  onRenameCancel,
  onNavigate,
  onCopyLink,
  onWorkflow,
  onRename,
  onDuplicate,
  onToggleArchive,
  onDelete,
  onTogglePrivate,
  onTransfer,
}: {
  form: FormSummary;
  canEdit: boolean;
  renamingId: string | null;
  renameValue: string;
  onRenameValueChange: (value: string) => void;
  onRenameSubmit: () => void;
  onRenameCancel: () => void;
  onNavigate: () => void;
  onCopyLink: () => void;
  onWorkflow: (action: FormWorkflowAction) => void;
  onRename: () => void;
  onDuplicate: () => void;
  onToggleArchive: () => void;
  onDelete: () => void;
  onTogglePrivate: () => void;
  onTransfer: () => void;
}) {
  const isLive = isFormLive(form);
  const builderHref = `/forms/${form.id}/builder`;
  const responsesHref = `/forms/${form.id}/submissions`;

  return (
    // biome-ignore lint/a11y/useSemanticElements: same reasoning as the table row above — role="button" + tabIndex + onKeyDown supply the missing button affordance around a card whose body also holds real, independently-clickable links/buttons
    <div
      className="card forms-grid-card"
      role="button"
      tabIndex={0}
      onClick={onNavigate}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onNavigate();
        }
      }}
    >
      <div className="forms-grid-card-header">
        {renamingId === form.id ? (
          <input
            className="text-input"
            value={renameValue}
            // biome-ignore lint/a11y/noAutofocus: user just clicked "rename" — focusing the field they're about to type into is the expected behavior
            autoFocus
            onClick={(event) => event.stopPropagation()}
            onChange={(event) => onRenameValueChange(event.target.value)}
            onBlur={onRenameSubmit}
            onKeyDown={(event) => {
              event.stopPropagation();
              if (event.key === 'Enter') onRenameSubmit();
              if (event.key === 'Escape') onRenameCancel();
            }}
          />
        ) : (
          <Link
            href={builderHref}
            className="admin-table-name-link forms-grid-card-title"
            onClick={(event) => event.stopPropagation()}
          >
            {form.name}
          </Link>
        )}
        <LiveStatusBadge status={form.status} isLive={isLive} />
      </div>

      <div className="forms-grid-card-meta">
        <span className="admin-table-creator">
          <span className="admin-table-avatar" aria-hidden="true">
            {getInitials(form.createdByName)}
          </span>
          {form.createdByName}
        </span>
        {form.isPrivate ? <span className="badge badge--neutral">Private</span> : null}
      </div>

      <div className="forms-grid-card-stats">
        <Link
          href={responsesHref}
          className="forms-responses-link"
          onClick={(event) => event.stopPropagation()}
        >
          {form.responseCount} {form.responseCount === 1 ? 'response' : 'responses'}
        </Link>
        <span title={new Date(form.updatedAt).toLocaleString('en-AU')}>
          Updated {formatRelativeTime(form.updatedAt)}
        </span>
      </div>

      {/* biome-ignore lint/a11y/noStaticElementInteractions: stopPropagation-only wrapper so clicking an action doesn't also trigger the card's own onClick navigation — same intent as the table row's action <td> above (exempt there as a semantic table cell), just a <div> in a card layout */}
      <div
        className="forms-grid-card-actions"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.stopPropagation()}
      >
        {canEdit && form.status === 'archived' ? (
          <button
            type="button"
            className="button button--small button--ghost"
            onClick={() => onToggleArchive()}
          >
            Restore
          </button>
        ) : canEdit && !isLive && form.status !== 'archived' ? (
          <button
            type="button"
            className="button button--small button--success"
            onClick={() => onWorkflow('publish')}
          >
            Publish
          </button>
        ) : isLive ? (
          <button
            type="button"
            className="button button--small button--ghost"
            onClick={() => onCopyLink()}
          >
            Share
          </button>
        ) : (
          <Link href={builderHref} className="button button--small button--ghost">
            {canEdit ? 'Edit' : 'View'}
          </Link>
        )}
        <FormActionsMenu
          formId={form.id}
          formUrl={form.publicUrl}
          status={form.status}
          isLive={isLive}
          canEdit={canEdit}
          onRename={onRename}
          onDuplicate={onDuplicate}
          onToggleArchive={onToggleArchive}
          onWorkflow={onWorkflow}
          onDelete={onDelete}
          isPrivate={form.isPrivate}
          isOwnForm={form.isOwnForm}
          onTogglePrivate={onTogglePrivate}
          onTransfer={onTransfer}
          onCopyLink={onCopyLink}
        />
      </div>
    </div>
  );
}
