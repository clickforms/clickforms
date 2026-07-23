'use client';

import { useRouter } from 'next/navigation';
import {
  type CSSProperties,
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { FieldInput, type FieldValue } from '@/app/f/[slug]/field-input';
import { DeleteSubmissionModal } from '@/app/forms/[id]/submissions/delete-submission-modal';
import { useToast } from '@/components/toast';
import { readApiError } from '@/lib/error-message';
import type { FormAnswers } from '@/lib/forms/conditional-logic';
import { getVisibleFieldIds } from '@/lib/forms/conditional-logic';
import { getFieldWidthClass } from '@/lib/forms/field-width';
import type { FormSchema } from '@/lib/forms/schema';
import { type AnswerErrors, validateAnswers } from '@/lib/forms/validate-answers';

interface SubmissionAnswersEditorProps {
  formId: string;
  submissionId: string;
  schema: FormSchema;
  initialAnswers: FormAnswers;
  canEditAnswers: boolean;
  canDelete: boolean;
  meta: ReactNode;
  children: ReactNode;
}

interface PresignResponse {
  uploadUrl?: string;
  storageKey?: string;
  error?: string;
}

interface ConfirmResponse {
  fileId?: string;
  error?: string;
}

interface PatchResponse {
  submissionId?: string;
  status?: string;
  error?: string;
  fieldErrors?: AnswerErrors;
}

function ChevronIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path
        d="M3 4.5l3 3 3-3"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Content-Disposition looks like `attachment; filename="some-form-2026-07-23.pdf"` (see
// submissionPdfFilename in lib/forms/generate-submission-pdf.ts) — a plain quoted-string
// extraction is enough since that filename is already sanitized server-side (lowercased,
// non-alphanumerics collapsed to hyphens) and never contains a literal `"`.
function parseFilenameFromContentDisposition(header: string | null): string | null {
  if (!header) return null;
  const match = /filename="?([^";]+)"?/i.exec(header);
  return match?.[1]?.trim() || null;
}

// Mirrors computePanelStyle in app/forms/form-actions-menu.tsx — same "anchor the panel
// under the trigger, flip above if it would overflow the viewport" behavior, kept as a
// separate copy since the two menus don't share a component yet.
function computePanelStyle(trigger: HTMLElement, panel: HTMLElement): CSSProperties {
  const triggerRect = trigger.getBoundingClientRect();
  const panelRect = panel.getBoundingClientRect();
  const gap = 6;
  const viewportPadding = 8;

  let top = triggerRect.bottom + gap;
  if (top + panelRect.height > window.innerHeight - viewportPadding) {
    const aboveTop = triggerRect.top - panelRect.height - gap;
    top = aboveTop >= viewportPadding ? aboveTop : viewportPadding;
  }

  let left = triggerRect.right - panelRect.width;
  left = Math.max(
    viewportPadding,
    Math.min(left, window.innerWidth - panelRect.width - viewportPadding),
  );

  return { position: 'fixed', top, left };
}

interface SubmissionActionsMenuProps {
  isExporting: boolean;
  onExport: () => Promise<void>;
  canEditAnswers: boolean;
  canDelete: boolean;
  onEdit: () => void;
  onDelete: () => void;
}

function SubmissionActionsMenu({
  isExporting,
  onExport,
  canEditAnswers,
  canDelete,
  onEdit,
  onDelete,
}: SubmissionActionsMenuProps) {
  const [open, setOpen] = useState(false);
  const [panelStyle, setPanelStyle] = useState<CSSProperties | null>(null);
  const menuId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLUListElement>(null);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current || !panelRef.current) return;
    setPanelStyle(computePanelStyle(triggerRef.current, panelRef.current));
  }, [open]);

  useEffect(() => {
    if (!open) return;

    function reposition() {
      if (!triggerRef.current || !panelRef.current) return;
      setPanelStyle(computePanelStyle(triggerRef.current, panelRef.current));
    }

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) {
        return;
      }
      setOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    }

    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      setPanelStyle(null);
    }
  }, [open]);

  const panel =
    open && typeof document !== 'undefined' ? (
      <ul
        ref={panelRef}
        className="actions-menu-panel"
        id={menuId}
        // biome-ignore lint/a11y/noNoninteractiveElementToInteractiveRole: this is the WAI-ARIA APG menu pattern (ul[role=menu] > li[role=none] > [role=menuitem]), matching form-actions-menu.tsx
        role="menu"
        style={{
          ...panelStyle,
          visibility: panelStyle ? 'visible' : 'hidden',
        }}
      >
        <li role="none">
          <button
            type="button"
            className="actions-menu-item"
            role="menuitem"
            disabled={isExporting}
            onClick={() => {
              // Deliberately not closing the menu immediately (unlike every other item) —
              // the export can take a few seconds (server-side PDF rendering via
              // Puppeteer), and closing right away would throw away the only place the
              // "Exporting…" label is visible, leaving no feedback that anything is
              // happening at all. Closes itself once the request settles either way.
              void onExport().then(() => setOpen(false));
            }}
          >
            {isExporting ? (
              <>
                <span className="actions-menu-spinner" aria-hidden="true" />
                Exporting…
              </>
            ) : (
              'Export PDF'
            )}
          </button>
        </li>
        {canEditAnswers ? (
          <li role="none">
            <button
              type="button"
              className="actions-menu-item"
              role="menuitem"
              onClick={() => {
                onEdit();
                setOpen(false);
              }}
            >
              Edit response
            </button>
          </li>
        ) : null}
        {canDelete ? (
          <>
            <li role="none">
              <hr className="actions-menu-divider" />
            </li>
            <li role="none">
              <button
                type="button"
                className="actions-menu-item actions-menu-item--danger"
                role="menuitem"
                onClick={() => {
                  onDelete();
                  setOpen(false);
                }}
              >
                Delete
              </button>
            </li>
          </>
        ) : null}
      </ul>
    ) : null;

  return (
    <div className="actions-menu">
      <button
        ref={triggerRef}
        type="button"
        className="actions-menu-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((current) => !current)}
      >
        Actions
        <ChevronIcon />
      </button>

      {panel ? createPortal(panel, document.body) : null}
    </div>
  );
}

/**
 * Owns the submission detail page's header actions (Export / Edit / Delete, collapsed
 * into one dropdown) plus the inline answer-editing view — both need to share `editing`
 * state, so this single client component renders the header row, the passed-through meta
 * card, and either the read-only view (`children`, server-rendered) or the edit form,
 * all from one place rather than splitting state across sibling components.
 *
 * Reuses the exact same FieldInput component and field-width CSS classes the live public
 * form renderer uses (see form-renderer-client.tsx) — those classes are globally scoped
 * in globals.css, not nested under the public form's wrapper, so they render correctly
 * here too. Uploads go through a parallel admin-scoped presign/confirm pair
 * (../uploads/presign, ../uploads/confirm routes) rather than the public respondent
 * routes, since those refuse once a submission has left "in_progress" — the whole point
 * of this feature is editing already-submitted responses.
 */
export function SubmissionAnswersEditor({
  formId,
  submissionId,
  schema,
  initialAnswers,
  canEditAnswers,
  canDelete,
  meta,
  children,
}: SubmissionAnswersEditorProps) {
  const [editing, setEditing] = useState(false);
  const [answers, setAnswers] = useState<FormAnswers>(initialAnswers);
  const [errors, setErrors] = useState<AnswerErrors>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const router = useRouter();
  const toast = useToast();

  const visibleFieldIds = useMemo(() => getVisibleFieldIds(schema, answers), [schema, answers]);
  const isMultiPage = schema.pages.length > 1;

  const handleChange = useCallback((fieldId: string, value: FieldValue) => {
    setAnswers((prev) => ({ ...prev, [fieldId]: value }));
    setErrors((prev) => {
      if (!(fieldId in prev)) return prev;
      const next = { ...prev };
      delete next[fieldId];
      return next;
    });
  }, []);

  const uploadFile = useCallback(
    async (fieldId: string, file: File): Promise<string> => {
      const presignRes = await fetch(
        `/api/forms/${formId}/submissions/${submissionId}/uploads/presign`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fieldId,
            filename: file.name,
            mimeType: file.type || 'application/octet-stream',
            sizeBytes: file.size,
          }),
        },
      );
      const presignData: PresignResponse = await presignRes.json();
      if (!presignRes.ok || !presignData.uploadUrl || !presignData.storageKey) {
        throw new Error(presignData.error ?? 'Could not start the upload. Please try again.');
      }

      const putRes = await fetch(presignData.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
        body: file,
      });
      if (!putRes.ok) {
        throw new Error('Uploading the file failed. Please try again.');
      }

      const confirmRes = await fetch(
        `/api/forms/${formId}/submissions/${submissionId}/uploads/confirm`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fieldId,
            storageKey: presignData.storageKey,
            filename: file.name,
            mimeType: file.type || 'application/octet-stream',
            sizeBytes: file.size,
          }),
        },
      );
      const confirmData: ConfirmResponse = await confirmRes.json();
      if (!confirmRes.ok || !confirmData.fileId) {
        throw new Error(confirmData.error ?? 'Could not finish the upload. Please try again.');
      }

      return confirmData.fileId;
    },
    [formId, submissionId],
  );

  function handleCancel() {
    setAnswers(initialAnswers);
    setErrors({});
    setSaveError(null);
    setEditing(false);
  }

  async function handleSave() {
    setSaveError(null);

    const fieldErrors = validateAnswers(schema, answers);
    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors);
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/forms/${formId}/submissions/${submissionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers }),
      });
      const data: PatchResponse = await res.json();

      if (!res.ok) {
        if (data.fieldErrors) {
          setErrors(data.fieldErrors);
        }
        setSaveError(data.error ?? (await readApiError(res, 'Failed to save changes')));
        return;
      }

      toast.success('Response updated');
      setEditing(false);
      router.refresh();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  }

  // Fetches the PDF as a blob instead of the old plain `<a href download>` — that approach
  // gave zero feedback while Puppeteer rendered server-side (seconds, not instant), and
  // when generation failed, the browser had no way to tell a JSON error body from a real
  // PDF: with no Content-Disposition on the error response and no filename on the link, it
  // fell back to guessing "pdf.json" from the URL + response MIME type and downloaded the
  // *error* under that name — a corrupt-looking, silently-wrong file instead of a visible
  // failure. Fetching lets us check res.ok before ever touching the browser's download UI.
  async function handleExportPdf() {
    setIsExporting(true);
    try {
      const res = await fetch(`/api/forms/${formId}/submissions/${submissionId}/export/pdf`);
      if (!res.ok) {
        throw new Error(await readApiError(res, 'Failed to export PDF'));
      }

      const blob = await res.blob();
      const filename =
        parseFilenameFromContentDisposition(res.headers.get('Content-Disposition')) ??
        'submission.pdf';

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to export PDF');
    } finally {
      setIsExporting(false);
    }
  }

  async function handleConfirmDelete() {
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/forms/${formId}/submissions/${submissionId}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error(await readApiError(response, 'Failed to delete response'));
      }
      toast.success('Response deleted');
      router.push(`/forms/${formId}/submissions`);
      router.refresh();
    } catch (err) {
      setIsDeleting(false);
      toast.error(err instanceof Error ? err.message : 'Failed to delete response');
    }
  }

  return (
    <>
      <div className="submission-detail-header">
        <h1>Submission</h1>
        <div className="submission-detail-header-actions">
          <SubmissionActionsMenu
            isExporting={isExporting}
            onExport={handleExportPdf}
            canEditAnswers={canEditAnswers}
            canDelete={canDelete}
            onEdit={() => setEditing(true)}
            onDelete={() => setDeleteOpen(true)}
          />
        </div>
      </div>

      {meta}

      {!editing ? (
        children
      ) : (
        <>
          {schema.pages.map((page) => (
            <div key={page.id} className="card submission-page submission-edit-form">
              {isMultiPage ? <h2 className="submission-page-title">{page.title}</h2> : null}

              {saveError ? <div className="form-error">{saveError}</div> : null}

              <div className="form-field-group-list">
                {page.fields.map((fieldId) => {
                  const field = schema.fields[fieldId];
                  if (!field || !visibleFieldIds.has(fieldId)) return null;

                  if (field.type === 'column_layout') {
                    const visibleChildren = field.fieldIds.filter(
                      (childId): childId is string =>
                        childId !== null && visibleFieldIds.has(childId),
                    );
                    if (visibleChildren.length === 0) return null;

                    return (
                      <div key={fieldId} className="form-column-layout field-width--full">
                        <div
                          className={`form-column-layout-grid form-column-layout-grid--${field.columns}`}
                        >
                          {visibleChildren.map((childId) => {
                            const child = schema.fields[childId];
                            if (!child) return null;
                            return (
                              <div key={childId} className="form-field-cell">
                                <FieldInput
                                  formId={formId}
                                  field={child}
                                  value={answers[childId]}
                                  error={errors[childId]}
                                  onChange={(value) => handleChange(childId, value)}
                                  onUploadFile={uploadFile}
                                  allFields={schema.fields}
                                  answers={answers}
                                  disableOptionGrid
                                />
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div key={fieldId} className={`form-field-cell ${getFieldWidthClass(field)}`}>
                      <FieldInput
                        formId={formId}
                        field={field}
                        value={answers[fieldId]}
                        error={errors[fieldId]}
                        onChange={(value) => handleChange(fieldId, value)}
                        onUploadFile={uploadFile}
                        allFields={schema.fields}
                        answers={answers}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          <div className="submission-edit-actions">
            <button
              type="button"
              className="button button--secondary"
              onClick={handleCancel}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="button"
              className="button button--primary"
              onClick={() => void handleSave()}
              disabled={saving}
            >
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </>
      )}

      <DeleteSubmissionModal
        open={deleteOpen}
        isDeleting={isDeleting}
        onClose={() => !isDeleting && setDeleteOpen(false)}
        onConfirm={() => void handleConfirmDelete()}
      />
    </>
  );
}
