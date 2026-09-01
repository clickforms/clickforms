'use client';

import type { FormStatus } from '@prisma/client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { CreateFormModal } from '@/app/forms/create-form-modal';
import { DeleteFormModal } from '@/app/forms/delete-form-modal';
import { FormActionsMenu } from '@/app/forms/form-actions-menu';
import { TransferFormModal } from '@/app/forms/transfer-form-modal';
import { LiveStatusBadge } from '@/components/live-status-badge';
import { useToast } from '@/components/toast';
import { readApiError } from '@/lib/error-message';
import { type FormWorkflowAction, runFormWorkflow } from '@/lib/forms/form-workflow-client';

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
  /** The version being edited (most recent by versionNumber). Diverging from
   *  currentVersionId means there are unpublished changes waiting. */
  latestVersionId: string | null;
}

interface OrgMember {
  id: string;
  name: string;
}

type SortColumn = 'name' | 'createdAt' | 'updatedAt' | 'responseCount' | 'status';
type SortDirection = 'asc' | 'desc';

const COLUMNS: { key: SortColumn; label: string }[] = [
  { key: 'name', label: 'Form name' },
  { key: 'createdAt', label: 'Created' },
  { key: 'updatedAt', label: 'Last updated' },
  { key: 'responseCount', label: 'Responses' },
  { key: 'status', label: 'Status' },
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
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [search, setSearch] = useState('');
  const toast = useToast();
  const router = useRouter();
  const [sortColumn, setSortColumn] = useState<SortColumn>('updatedAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [deletingForm, setDeletingForm] = useState<FormSummary | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [transferringForm, setTransferringForm] = useState<FormSummary | null>(null);
  const [isTransferring, setIsTransferring] = useState(false);
  const [page, setPage] = useState(1);

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
      const { form: newForm, version: newVersion } = await response.json();
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
          latestVersionId: newVersion?.id ?? null,
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
        approve: 'Form approved — ready to publish',
        publish: 'Form published',
        unpublish: 'Form taken offline',
        'revert-to-draft': 'Form reverted to draft',
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
    const filtered = term ? forms.filter((form) => form.name.toLowerCase().includes(term)) : forms;

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
  }, [forms, search, sortColumn, sortDirection]);

  // Jump back to page 1 whenever the search/sort narrows or reorders the list — otherwise
  // a page number that used to be valid could land past the end of a smaller result set.
  // biome-ignore lint/correctness/useExhaustiveDependencies: deps intentionally trigger a reset even though the effect body doesn't read them
  useEffect(() => {
    setPage(1);
  }, [search, sortColumn, sortDirection]);

  const totalPages = Math.max(1, Math.ceil(visibleForms.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageForms = visibleForms.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <div>
      <div className="forms-list-header">
        {canEdit ? (
          <button
            type="button"
            className="button button--dark"
            onClick={() => setIsCreateModalOpen(true)}
          >
            + New form
          </button>
        ) : null}
      </div>

      {canEdit ? (
        <CreateFormModal open={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} />
      ) : null}

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
          <p>No forms yet. Create one to get started.</p>
        </div>
      ) : (
        <div className="card admin-table-card">
          <div className="table-search-row">
            <label className="forms-search">
              <span className="forms-search-icon">
                <SearchIcon />
              </span>
              <input
                type="text"
                placeholder="Search forms by name…"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                aria-label="Search forms"
              />
            </label>
          </div>
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
                  const isLive = form.currentVersionId !== null && form.status !== 'archived';
                  const hasPendingChanges =
                    isLive && form.latestVersionId !== form.currentVersionId;
                  const builderHref = `/forms/${form.id}/builder`;
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
                      <td data-label="Created">
                        {new Date(form.createdAt).toLocaleDateString('en-AU')}
                      </td>
                      <td data-label="Last updated">
                        {new Date(form.updatedAt).toLocaleDateString('en-AU')}
                      </td>
                      <td data-label="Responses">{form.responseCount}</td>
                      <td data-label="Status">
                        <LiveStatusBadge
                          status={form.status}
                          isLive={isLive}
                          hasPendingChanges={hasPendingChanges}
                        />
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
                      </td>
                    </tr>
                  );
                })}
                {visibleForms.length === 0 ? (
                  <tr>
                    <td colSpan={COLUMNS.length + 2} className="admin-table-empty">
                      No forms match &ldquo;{search}&rdquo;.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

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
