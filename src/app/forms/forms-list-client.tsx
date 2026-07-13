'use client';

import type { FormStatus } from '@prisma/client';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { CreateFormModal } from '@/app/forms/create-form-modal';
import { DeleteFormModal } from '@/app/forms/delete-form-modal';
import { FormActionsMenu } from '@/app/forms/form-actions-menu';
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
}

const STATUS_BADGE: Record<FormStatus, { label: string; className: string }> = {
  draft: { label: 'Draft', className: 'badge--draft' },
  approved: { label: 'Approved', className: 'badge--approved' },
  published: { label: 'Published', className: 'badge--success' },
  archived: { label: 'Archived', className: 'badge--neutral' },
};

type SortColumn = 'name' | 'createdAt' | 'updatedAt' | 'responseCount' | 'status';
type SortDirection = 'asc' | 'desc';

const COLUMNS: { key: SortColumn; label: string }[] = [
  { key: 'name', label: 'Form name' },
  { key: 'createdAt', label: 'Created' },
  { key: 'updatedAt', label: 'Last updated' },
  { key: 'responseCount', label: 'Responses' },
  { key: 'status', label: 'Status' },
];

export function FormsListClient({
  initialForms,
  canEdit,
}: {
  initialForms: FormSummary[];
  canEdit: boolean;
}) {
  const [forms, setForms] = useState(initialForms);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [search, setSearch] = useState('');
  const toast = useToast();
  const [sortColumn, setSortColumn] = useState<SortColumn>('updatedAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [deletingForm, setDeletingForm] = useState<FormSummary | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

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
        },
        ...current,
      ]);
      toast.success('Form duplicated');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to duplicate form');
    }
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
          entry.id === form.id ? { ...entry, status: body.form.status as FormStatus } : entry,
        ),
      );

      const messages: Record<FormWorkflowAction, string> = {
        approve: 'Form approved — ready to publish',
        publish: 'Form published',
        unpublish: 'Form unpublished',
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

  return (
    <div>
      <div className="forms-list-header">
        {canEdit ? (
          <button type="button" className="button" onClick={() => setIsCreateModalOpen(true)}>
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

      {forms.length === 0 ? (
        <div className="card empty-state">
          <p>No forms yet. Create one to get started.</p>
        </div>
      ) : (
        <div className="card admin-table-card">
          <div className="table-search-row">
            <input
              className="text-input"
              placeholder="Search forms by name…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              aria-label="Search forms"
            />
          </div>
          <div className="admin-table-scroll">
            <table className="admin-table">
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
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleForms.map((form) => {
                  const badge = STATUS_BADGE[form.status];
                  return (
                    <tr key={form.id}>
                      <td data-label="Form name">
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
                          <Link
                            href={`/forms/${form.id}/builder`}
                            className="admin-table-name-link"
                          >
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
                        <span className={`badge ${badge.className}`}>{badge.label}</span>
                      </td>
                      <td data-label="Actions">
                        <FormActionsMenu
                          formId={form.id}
                          formSlug={form.slug}
                          status={form.status}
                          canEdit={canEdit}
                          onRename={() => {
                            setRenamingId(form.id);
                            setRenameValue(form.name);
                          }}
                          onDuplicate={() => handleDuplicate(form)}
                          onToggleArchive={() => handleToggleArchive(form)}
                          onWorkflow={(action) => handleWorkflow(form, action)}
                          onDelete={() => setDeletingForm(form)}
                        />
                      </td>
                    </tr>
                  );
                })}
                {visibleForms.length === 0 ? (
                  <tr>
                    <td colSpan={COLUMNS.length + 1} className="admin-table-empty">
                      No forms match &ldquo;{search}&rdquo;.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
