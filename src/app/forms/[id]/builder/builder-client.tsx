'use client';

import {
  type CollisionDetection,
  closestCenter,
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import type { FormStatus } from '@prisma/client';
import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BuilderPanelScroll } from '@/app/forms/[id]/builder/builder-panel-scroll';
import { BuilderRail, type BuilderRailTab } from '@/app/forms/[id]/builder/builder-rail';
import { CANVAS_DROPPABLE_ID, Canvas } from '@/app/forms/[id]/builder/canvas';
import { ConditionalLogicEditor } from '@/app/forms/[id]/builder/conditional-logic-editor';
import { ConditionalPreviewBar } from '@/app/forms/[id]/builder/conditional-preview-bar';
import { DesignSettingsPanel } from '@/app/forms/[id]/builder/design-settings-panel';
import { FieldDragOverlay, parseColumnSlotDroppableId } from '@/app/forms/[id]/builder/field-card';
import {
  COLUMN_LAYOUT_LABELS,
  createDefaultField,
  describeFormSchemaValidationError,
  FIELD_TYPE_LABELS,
} from '@/app/forms/[id]/builder/field-meta';
import { FieldPalette } from '@/app/forms/[id]/builder/field-palette';
import { FieldSettingsPanel } from '@/app/forms/[id]/builder/field-settings-panel';
import { PageTabs } from '@/app/forms/[id]/builder/page-tabs';
import {
  addColumnLayoutToPage,
  addFieldToPage,
  addPage,
  clearConditionalRule,
  duplicateField,
  type FieldPatch,
  findParentColumnLayout,
  isColumnChildFieldType,
  moveFieldInPage,
  removeField,
  removePage,
  renamePage,
  reorderFieldsInPage,
  reorderPages,
  replaceFieldType,
  setColumnLayoutColumns,
  setColumnSlotField,
  setConditionalRule,
  updateField,
} from '@/app/forms/[id]/builder/schema-mutations';
import { useFormWorkspaceStatus } from '@/app/forms/[id]/form-workspace-context';
import { DropdownMenu } from '@/components/dropdown-menu';
import { useToast } from '@/components/toast';
import { extractApiError, getErrorMessage } from '@/lib/error-message';
import type { FormAnswers } from '@/lib/forms/conditional-logic';
import { getVisibleFieldIds } from '@/lib/forms/conditional-logic';
import {
  type FormWorkflowAction,
  type FormWorkflowResult,
  getWorkflowStepForStatus,
  runFormWorkflow,
} from '@/lib/forms/form-workflow-client';
import type {
  ColumnCount,
  ConditionalRule,
  FieldType,
  FormBranding,
  FormField,
  FormPage,
  FormSchema,
} from '@/lib/forms/schema';
import { createEmptyFormSchema, formSchemaSchema } from '@/lib/forms/schema';

interface VersionMeta {
  id: string;
  versionNumber: number;
  publishedAt: string | null;
}

interface BuilderClientProps {
  formId: string;
  formName: string;
  initialVersion: (VersionMeta & { schema: FormSchema }) | null;
  /** The version currently served to respondents, if any — independent of `status`
   *  (see src/lib/forms/live-status.ts). */
  initialCurrentVersionId: string | null;
  canEdit: boolean;
}

type SaveStatus = 'idle' | 'saving' | 'error';

interface DragPayload {
  source?: 'palette';
  fieldType?: FieldType;
  columnLayoutColumns?: ColumnCount;
}

function CloseIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M3 8h10M9 4l4 4-4 4"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M10 4v12M4 10h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function KebabIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="3.4" r="1.15" fill="currentColor" />
      <circle cx="8" cy="8" r="1.15" fill="currentColor" />
      <circle cx="8" cy="12.6" r="1.15" fill="currentColor" />
    </svg>
  );
}

function TakeOfflineIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M8 2.5v7M5 6.5 8 9.5l3-3"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M3 12.5h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

/** Deliberately not a chevron — this handle sits directly beside PageTabs' own prev/next
 * arrows, and a rotated chevron here reads as a third, conflicting direction cue in the
 * same small area. A panel glyph that fills in on its own left third when closed (echoing
 * the handle's real position at the box's left edge) signals "collapsed vs. expanded" by
 * shape alone, with nothing to point the wrong way. */
function PanelToggleIcon({ open }: { open: boolean }) {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect
        x="2.5"
        y="3"
        width="11"
        height="10"
        rx="1.75"
        stroke="currentColor"
        strokeWidth="1.3"
      />
      <path d="M6.25 3v10" stroke="currentColor" strokeWidth="1.3" />
      {open ? null : (
        <rect x="3.15" y="3.65" width="2.5" height="8.7" rx="0.6" fill="currentColor" />
      )}
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M8 2v1.5M8 12.5V14M2 8h1.5M12.5 8H14M4 4l1 1M11 11l1 1M4 12l1-1M11 5l1-1"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  );
}

function EditFormIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M10.5 2.5l3 3L5.5 13.5H2.5v-3L10.5 2.5z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Only shown while editing — reflects the network state of the current manual Save
 *  action plus whether there are edits sitting unsaved in the canvas. There's no
 *  autosave anymore (see the "Save"/"Cancel" buttons in the toolbar), so this never
 *  needs to represent a debounce-pending state. */
function SaveStatusBadge({
  status,
  hasUnsavedChanges,
  error,
}: {
  status: SaveStatus;
  hasUnsavedChanges: boolean;
  error: string | null;
}) {
  if (status === 'saving') {
    return <span className="builder-save-status">Saving…</span>;
  }
  if (status === 'error') {
    return (
      <span className="builder-save-status builder-save-status--error" title={error ?? undefined}>
        Save failed
      </span>
    );
  }
  if (hasUnsavedChanges) {
    return (
      <span className="builder-save-status builder-save-status--pending">Unsaved changes</span>
    );
  }
  return null;
}

export function BuilderClient({
  formId,
  formName,
  initialVersion,
  initialCurrentVersionId,
  canEdit,
}: BuilderClientProps) {
  const toast = useToast();
  const { status: formStatus, setStatus: setFormStatus, syncLiveState } = useFormWorkspaceStatus();
  const [schema, setSchema] = useState<FormSchema>(
    initialVersion?.schema ?? createEmptyFormSchema(),
  );
  // Kept in sync with the server after every save/workflow transition even though
  // nothing currently reads it — retained as the natural place to hang a future "viewing
  // version N" indicator rather than re-deriving it from scratch later.
  const [_version, setVersion] = useState<VersionMeta | null>(
    initialVersion
      ? {
          id: initialVersion.id,
          versionNumber: initialVersion.versionNumber,
          publishedAt: initialVersion.publishedAt,
        }
      : null,
  );
  // Drives the Live indicator and the "Take offline"/"Edit form" actions — only changes
  // via an explicit publish/unpublish, never as a side effect of editing (see
  // applyWorkflowResult and public-lookup.ts's getFormForExistingSubmission).
  const [currentVersionId, setCurrentVersionId] = useState<string | null>(initialCurrentVersionId);
  // Truth of "is this reachable by respondents right now" — see live-status.ts.
  const isLive = currentVersionId !== null && formStatus !== 'archived';
  // The canvas is locked by default — draft or live, published or not — until the user
  // explicitly clicks "Edit". This is on top of, not instead of, the permission-based
  // `canEdit` gate. Editing a live form additionally requires confirming the take-offline
  // warning first (see the confirmation modal below and handleEditClick).
  const [isEditing, setIsEditing] = useState(false);
  const canEditCanvas = canEdit && isEditing;
  const [activePageId, setActivePageId] = useState<string>(() => schema.pages[0]?.id ?? '');
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  // Which field's settings modal is open, if any — separate from selection so selecting a
  // field (to show its overlay on the canvas) doesn't itself pop the modal open.
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);
  // Which panel the tabs at the top of .builder-palette show —
  // Fields (palette or the selected field's settings, today's behavior), Design
  // (form-wide branding, previously only reachable via the "Form settings" modal below —
  // that modal still exists too, for mobile where the palette is hidden), or Logic
  // (conditional rules for whichever field is selected/being edited).
  const [activeRailTab, setActiveRailTab] = useState<BuilderRailTab>('fields');
  const [showFormSettings, setShowFormSettings] = useState(false);
  const [showEditConfirm, setShowEditConfirm] = useState(false);
  const [showMobilePalette, setShowMobilePalette] = useState(false);
  // Drawer state for the floating page-selector/actions box (.builder-header) — slides
  // off to the right when collapsed, leaving just its handle tab visible so it can be
  // reopened without permanently losing access to Approve/page navigation (Share now
  // lives in FormTopNav instead, so it isn't part of what this drawer hides).
  const [toolbarOpen, setToolbarOpen] = useState(true);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const moreMenuTriggerRef = useRef<HTMLButtonElement>(null);
  const [mockAnswers, setMockAnswers] = useState<FormAnswers>({});
  const [activeDrag, setActiveDrag] = useState<
    { source: 'palette'; label: string } | { source: 'canvas'; fieldId: string } | null
  >(null);

  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isWorkflowBusy, setIsWorkflowBusy] = useState(false);

  // The last schema known to be persisted on the server — compared against the live
  // `schema` state to derive hasUnsavedChanges, and what Cancel reverts back to.
  const lastSavedSchemaJsonRef = useRef<string>(JSON.stringify(schema));

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  /** Prefer field cards over the large canvas dropzone so rearranging isn't cancelled
   * when closestCenter snaps to the canvas wrapper (CANVAS_DROPPABLE_ID). */
  const collisionDetection: CollisionDetection = useCallback((args) => {
    const pointerHits = pointerWithin(args);
    const pointerFields = pointerHits.filter(({ id }) => id !== CANVAS_DROPPABLE_ID);
    if (pointerFields.length > 0) return pointerFields;
    if (pointerHits.length > 0) return pointerHits;

    const centerHits = closestCenter(args);
    const centerFields = centerHits.filter(({ id }) => id !== CANVAS_DROPPABLE_ID);
    return centerFields.length > 0 ? centerFields : centerHits;
  }, []);

  // No autosave: schema edits only leave the browser when the user explicitly clicks
  // Save (see handleSaveAndClose below) — deliberate, so an accidental change to a live
  // form's schema can never slip onto the server unnoticed.
  const saveSchema = useCallback(async (): Promise<boolean> => {
    const parsed = formSchemaSchema.safeParse(schema);
    if (!parsed.success) {
      const message = describeFormSchemaValidationError(schema, parsed.error);
      setSaveStatus('error');
      setSaveError(message);
      toast.error(message);
      return false;
    }

    setSaveStatus('saving');
    setSaveError(null);
    try {
      const response = await fetch(`/api/forms/${formId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schema: parsed.data }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(extractApiError(body, 'Failed to save changes'));
      }
      lastSavedSchemaJsonRef.current = JSON.stringify(schema);
      if (body?.version) {
        setVersion({
          id: body.version.id,
          versionNumber: body.version.versionNumber,
          publishedAt: body.version.publishedAt,
        });
      }
      if (body?.form?.status) {
        setFormStatus(body.form.status);
      }
      setSaveStatus('idle');
      return true;
    } catch (err) {
      const message = getErrorMessage(err, 'Failed to save changes');
      setSaveStatus('error');
      setSaveError(message);
      toast.error(message);
      return false;
    }
  }, [schema, formId, setFormStatus, toast]);

  function applyWorkflowResult(body: FormWorkflowResult) {
    const nextStatus = body?.form?.status as FormStatus | undefined;
    if (!nextStatus) {
      throw new Error('Server did not return an updated form status');
    }
    setFormStatus(nextStatus);
    setCurrentVersionId(body.form.currentVersionId ?? null);
    if (body.version) {
      setVersion({
        id: body.version.id,
        versionNumber: body.version.versionNumber,
        publishedAt: body.version.publishedAt
          ? new Date(body.version.publishedAt).toISOString()
          : null,
      });
    }
  }

  // Workflow actions (publish/unpublish) only ever run while the canvas is locked
  // (!isEditing) — the toolbar only renders their buttons in that state — so there's
  // never unsaved schema state to flush first; schema === last-saved by construction.
  async function runWorkflowAction(
    action: FormWorkflowAction,
    body?: Record<string, unknown>,
  ): Promise<boolean> {
    if (!canEdit || isWorkflowBusy) return false;

    setIsWorkflowBusy(true);
    try {
      const result = await runFormWorkflow(formId, action, body);
      applyWorkflowResult(result);

      const messages: Record<FormWorkflowAction, string> = {
        publish: `Published as v${result.version?.versionNumber ?? ''}`.trim(),
        unpublish:
          body?.intent === 'edit'
            ? 'Form taken offline — you can edit it now'
            : 'Form taken offline',
      };
      toast.success(messages[action] ?? 'Status updated');
      return true;
    } catch (err) {
      toast.error(getErrorMessage(err, 'Something went wrong'));
      return false;
    } finally {
      setIsWorkflowBusy(false);
    }
  }

  async function handleWorkflowAction() {
    const step = getWorkflowStepForStatus(formStatus);
    if (!step || !canRunWorkflow) return;
    await runWorkflowAction(step.action);
  }

  async function handleTakeOffline() {
    await runWorkflowAction('unpublish');
  }

  /** Clicking "Edit": a live form must be taken offline first (confirmed via the modal
   *  below), a form that's already offline just unlocks the canvas immediately — there's
   *  no live version at risk, so no confirmation is needed. */
  function handleEditClick() {
    if (!canEdit) return;
    if (isLive) {
      setShowEditConfirm(true);
      return;
    }
    setIsEditing(true);
  }

  async function handleConfirmEditForm() {
    setShowEditConfirm(false);
    const tookOffline = await runWorkflowAction('unpublish', { intent: 'edit' });
    if (tookOffline) setIsEditing(true);
  }

  /** Save persists the current schema and immediately re-locks the canvas — every editing
   *  session ends in the same, unambiguous locked state, whether or not anything actually
   *  changed. */
  async function handleSaveAndClose() {
    if (hasUnsavedChanges) {
      const saved = await saveSchema();
      if (!saved) return;
      toast.success('Form saved');
    }
    setIsEditing(false);
  }

  /** Discards any unsaved edits (after confirming, since this can throw away real work)
   *  and re-locks the canvas on the last-saved schema. */
  function handleCancelEditing() {
    if (hasUnsavedChanges) {
      const confirmed = window.confirm(
        'Discard your unsaved changes to this form? This cannot be undone.',
      );
      if (!confirmed) return;
    }
    const restored = JSON.parse(lastSavedSchemaJsonRef.current) as FormSchema;
    setSchema(restored);
    setActivePageId(restored.pages[0]?.id ?? '');
    setSelectedFieldId(null);
    setEditingFieldId(null);
    setSaveStatus('idle');
    setSaveError(null);
    setIsEditing(false);
  }

  function handleSelectField(fieldId: string) {
    const active = document.activeElement;
    if (active instanceof HTMLElement && active.closest('.settings-panel')) {
      active.blur();
    }
    startTransition(() => {
      setSelectedFieldId((current) => (current === fieldId ? current : fieldId));
    });
    if (canEditCanvas) {
      setEditingFieldId(fieldId);
      setActiveRailTab((current) => (current === 'design' ? 'fields' : current));
    }
  }

  function handleEditFieldDetails(fieldId: string) {
    setSelectedFieldId(fieldId);
    setEditingFieldId(fieldId);
    // Design isn't scoped to a field, so a real "edit this field" action should always
    // pull the admin back into the Fields tab to see it — but leave them on Logic alone
    // (switching fields while reviewing logic should just re-scope to the new field, not
    // yank them back to the Content/Validation view they weren't looking at).
    setActiveRailTab((current) => (current === 'design' ? 'fields' : current));
  }

  function handleCloseFieldModal() {
    setEditingFieldId(null);
    setSelectedFieldId(null);
  }

  function handleChangeRailTab(tab: BuilderRailTab) {
    setActiveRailTab(tab);
    if (tab === 'fields') {
      handleCloseFieldModal();
    }
  }

  function handleAddField(type: FieldType, index?: number) {
    if (!canEditCanvas) return;
    const field: FormField = createDefaultField(type);
    setSchema((prev) => addFieldToPage(prev, activePageId, field, index));
    setSelectedFieldId(field.id);
    setEditingFieldId(field.id);
    setActiveRailTab((current) => (current === 'design' ? 'fields' : current));
  }

  function handleAddColumnLayout(columns: ColumnCount, index?: number) {
    if (!canEditCanvas) return;
    const { schema: next, layoutId } = addColumnLayoutToPage(schema, activePageId, columns, index);
    setSchema(next);
    setSelectedFieldId(layoutId);
    setEditingFieldId(layoutId);
    setActiveRailTab((current) => (current === 'design' ? 'fields' : current));
  }

  function handleSetColumnLayoutColumns(layoutId: string, columns: ColumnCount) {
    if (!canEditCanvas) return;
    setSchema((prev) => setColumnLayoutColumns(prev, layoutId, columns));
  }

  /** Fills an empty column slot with a freshly-created field of `type`, then selects it. */
  function handleAddColumnField(layoutId: string, slotIndex: number, type: FieldType) {
    if (!canEditCanvas) return;
    const result = setColumnSlotField(schema, layoutId, slotIndex, type);
    if (!result) return;
    setSchema(result.schema);
    setSelectedFieldId(result.fieldId);
    setEditingFieldId(result.fieldId);
    setActiveRailTab((current) => (current === 'design' ? 'fields' : current));
  }

  function handleRemoveField(fieldId: string) {
    if (!canEditCanvas) return;
    setSchema((prev) => removeField(prev, fieldId));
    setSelectedFieldId((current) => (current === fieldId ? null : current));
    setEditingFieldId((current) => (current === fieldId ? null : current));
  }

  function handleReplaceFieldType(fieldId: string, type: FieldType) {
    if (!canEditCanvas) return;
    setSchema((prev) => replaceFieldType(prev, fieldId, type));
  }

  function handleDuplicateField(fieldId: string) {
    if (!canEditCanvas) return;
    const page = schema.pages.find((entry) => entry.id === activePageId);
    const index = page?.fields.indexOf(fieldId) ?? -1;
    const next = duplicateField(schema, activePageId, fieldId);
    const newFieldId =
      next.pages.find((entry) => entry.id === activePageId)?.fields[index + 1] ?? null;
    setSchema(next);
    if (newFieldId) setSelectedFieldId(newFieldId);
  }

  function handleMoveField(fieldId: string, direction: 'up' | 'down') {
    if (!canEditCanvas) return;
    setSchema((prev) => moveFieldInPage(prev, activePageId, fieldId, direction));
  }

  function handleUpdateField(fieldId: string, patch: FieldPatch) {
    if (!canEditCanvas) return;
    setSchema((prev) => updateField(prev, fieldId, patch));
  }

  function handleUpdateBranding(patch: Partial<FormBranding>) {
    if (!canEditCanvas) return;
    setSchema((prev) => ({ ...prev, branding: { ...prev.branding, ...patch } }));
  }

  function handleSetConditionalRule(rule: ConditionalRule) {
    if (!canEditCanvas) return;
    setSchema((prev) => setConditionalRule(prev, rule));
  }

  function handleClearConditionalRule(fieldId: string) {
    if (!canEditCanvas) return;
    setSchema((prev) => clearConditionalRule(prev, fieldId));
  }

  function handleAddPage() {
    if (!canEditCanvas) return;
    const id = crypto.randomUUID();
    const page: FormPage = { id, title: `Page ${schema.pages.length + 1}`, fields: [] };
    setSchema((prev) => addPage(prev, page));
    setActivePageId(id);
    setSelectedFieldId(null);
  }

  function handleRemovePage(pageId: string) {
    if (!canEditCanvas || schema.pages.length <= 1) return;
    setSchema((prev) => removePage(prev, pageId));
    if (activePageId === pageId) {
      const remaining = schema.pages.filter((page) => page.id !== pageId);
      const next = remaining[0];
      if (next) setActivePageId(next.id);
    }
    setSelectedFieldId(null);
  }

  function handleRenamePage(pageId: string, title: string) {
    if (!canEditCanvas) return;
    setSchema((prev) => renamePage(prev, pageId, title));
  }

  function handleMovePage(pageId: string, direction: 'left' | 'right') {
    if (!canEditCanvas) return;
    const index = schema.pages.findIndex((page) => page.id === pageId);
    if (index === -1) return;
    const targetIndex = direction === 'left' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= schema.pages.length) return;

    const ids = schema.pages.map((page) => page.id);
    const moved = arrayMove(ids, index, targetIndex);
    setSchema((prev) => reorderPages(prev, moved));
  }

  function handleSelectPage(pageId: string) {
    setActivePageId(pageId);
    setSelectedFieldId(null);
  }

  function handleChangeMockAnswer(fieldId: string, value: string | string[] | undefined) {
    setMockAnswers((prev) => ({ ...prev, [fieldId]: value }));
  }

  function handleDragStart(event: DragStartEvent) {
    if (!canEditCanvas) return;
    const data = event.active.data.current as DragPayload | undefined;
    if (data?.source === 'palette' && data.columnLayoutColumns) {
      setActiveDrag({ source: 'palette', label: COLUMN_LAYOUT_LABELS[data.columnLayoutColumns] });
      return;
    }
    if (data?.source === 'palette' && data.fieldType) {
      setActiveDrag({ source: 'palette', label: FIELD_TYPE_LABELS[data.fieldType] });
      return;
    }
    setActiveDrag({ source: 'canvas', fieldId: event.active.id.toString() });
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveDrag(null);
    if (!canEditCanvas) return;
    const { active, over } = event;
    if (!over) return;

    const activePage = schema.pages.find((page) => page.id === activePageId);
    if (!activePage) return;

    const data = active.data.current as DragPayload | undefined;
    const overId = over.id.toString();
    const overIndex = activePage.fields.indexOf(overId);

    if (data?.source === 'palette' && data.columnLayoutColumns) {
      handleAddColumnLayout(data.columnLayoutColumns, overIndex === -1 ? undefined : overIndex);
      return;
    }

    if (data?.source === 'palette' && data.fieldType) {
      // Dropping a palette field onto an empty column slot fills that slot.
      const slot = parseColumnSlotDroppableId(overId);
      if (slot && isColumnChildFieldType(data.fieldType)) {
        handleAddColumnField(slot.layoutId, slot.slotIndex, data.fieldType);
        return;
      }
      // Dropping a palette field onto an occupied column cell replaces that cell's type.
      const parentLayout = findParentColumnLayout(schema, overId);
      if (parentLayout && isColumnChildFieldType(data.fieldType)) {
        handleReplaceFieldType(overId, data.fieldType);
        setSelectedFieldId(overId);
        return;
      }
      handleAddField(data.fieldType, overIndex === -1 ? undefined : overIndex);
      return;
    }

    const activeId = active.id.toString();
    if (activeId === overId || overId === CANVAS_DROPPABLE_ID) return;

    const fromIndex = activePage.fields.indexOf(activeId);
    const toIndex = overIndex;
    if (fromIndex === -1 || toIndex === -1) return;

    const reordered = arrayMove(activePage.fields, fromIndex, toIndex);
    setSchema((prev) => reorderFieldsInPage(prev, activePageId, reordered));
  }

  const activePage = schema.pages.find((page) => page.id === activePageId);
  const activePageIndex = schema.pages.findIndex((page) => page.id === activePageId);
  const editingField = editingFieldId ? (schema.fields[editingFieldId] ?? null) : null;
  // Duplicate lives in the modal's own header now (see the "Edit field" modal below)
  // rather than inside FieldSettingsPanel — that panel is only ever rendered in this one
  // modal, so its own second header row was just restating "Edit field" a second time.
  const isEditingColumnChild = editingField
    ? Boolean(findParentColumnLayout(schema, editingField.id))
    : false;
  // The field the Logic rail tab is scoped to — prefers the field currently open in
  // settings (editingField), but falls back to a plain canvas selection so clicking a
  // field is enough to check/add its logic without first entering the Fields tab.
  const logicField =
    editingField ?? (selectedFieldId ? (schema.fields[selectedFieldId] ?? null) : null);
  // Resolved once here (rather than indexing schema.fields[activeDrag.fieldId] twice
  // inline in the DragOverlay JSX below) so TS can actually narrow away `undefined` —
  // repeating the same computed-index expression doesn't narrow across two separate
  // reads, even when the first read already gated a ternary on it being truthy.
  const dragOverlayField =
    activeDrag?.source === 'canvas' ? schema.fields[activeDrag.fieldId] : undefined;

  const visibleFieldIds = useMemo(
    () => getVisibleFieldIds(schema, mockAnswers),
    [schema, mockAnswers],
  );
  const fieldIdsWithRules = useMemo(
    () => new Set(schema.conditionalLogic.map((rule) => rule.fieldId)),
    [schema.conditionalLogic],
  );

  const isSaveBusy = saveStatus === 'saving';
  // Deliberately NOT memoized on `schema` alone: the other half of this comparison,
  // lastSavedSchemaJsonRef, is a ref that changes after every successful save without
  // `schema` itself changing — a useMemo keyed on just [schema] would keep returning its
  // stale cached `true` from before the save, leaving "Unsaved changes" (and a disabled
  // Publish button) stuck on-screen even though the save succeeded. Plain recomputation
  // on every render is cheap enough for a form schema and always correct.
  const hasUnsavedChanges = JSON.stringify(schema) !== lastSavedSchemaJsonRef.current;
  const workflowStep = getWorkflowStepForStatus(formStatus);
  // Belt-and-suspenders: the Publish button is only ever rendered while !isEditing, at
  // which point hasUnsavedChanges is always false by construction — but disabling on it
  // too means Publish can never fire against a stale/dirty schema even if that invariant
  // is ever broken.
  const canRunWorkflow = workflowStep !== null && formStatus === 'draft' && !hasUnsavedChanges;

  // FormTopNav renders the Live/Draft badge (it lives in the shared top row, outside
  // this component's tree), so push the value it needs up into context whenever it
  // changes rather than duplicating the badge here too. It also needs hasUnsavedChanges,
  // to warn before navigating to another tab (Responses/Settings) mid-edit.
  useEffect(() => {
    syncLiveState({ isLive, hasUnsavedChanges });
  }, [isLive, hasUnsavedChanges, syncLiveState]);

  // Covers closing the tab, refreshing, or typing a new URL — the browser's own
  // confirmation dialog, which can't be replaced with custom copy. In-app navigation
  // (clicking Responses/Settings while mid-edit) is guarded separately in FormTopNav,
  // since beforeunload never fires for a client-side route change.
  useEffect(() => {
    if (!hasUnsavedChanges) return;
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = '';
    }
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  return (
    <>
      {/* Sibling of .builder (below), not its child — sits directly on the page's own
          gray background rather than inside the white bordered card, so the space to its
          left reads as background, not part of the card, and the card itself starts
          right at the top instead of being pushed down by this row. */}
      <header className={`builder-header ${toolbarOpen ? '' : 'builder-header--closed'}`}>
        <button
          type="button"
          className="builder-header-handle"
          onClick={() => setToolbarOpen((value) => !value)}
          aria-label={toolbarOpen ? 'Collapse toolbar' : 'Expand toolbar'}
          aria-expanded={toolbarOpen}
        >
          <PanelToggleIcon open={toolbarOpen} />
        </button>
        {!canEdit ? <span className="builder-readonly-badge">Read-only</span> : null}
        {canEdit ? (
          <>
            <SaveStatusBadge
              status={saveStatus}
              hasUnsavedChanges={hasUnsavedChanges}
              error={saveError}
            />
            <PageTabs
              pages={schema.pages}
              activePageId={activePage?.id ?? ''}
              canEdit={canEditCanvas}
              onSelectPage={handleSelectPage}
              onAddPage={handleAddPage}
              onRemovePage={handleRemovePage}
              onRenamePage={handleRenamePage}
              onMovePage={handleMovePage}
            />
            {/* Just the kebab now — Share moved up to FormTopNav, next to Preview, since
                the live link is the same regardless of which tab is active rather than
                being a builder-specific concern. */}
            <div className="builder-header-utility">
              <button
                ref={moreMenuTriggerRef}
                type="button"
                className="button button--ghost button--small builder-header-kebab"
                onClick={() => setMoreMenuOpen((value) => !value)}
                aria-haspopup="true"
                aria-label="More actions"
              >
                <KebabIcon />
              </button>
              <DropdownMenu
                open={moreMenuOpen}
                onOpenChange={setMoreMenuOpen}
                triggerRef={moreMenuTriggerRef}
                align="end"
              >
                <ul className="builder-more-menu-list">
                  <li>
                    <button
                      type="button"
                      className="actions-menu-item"
                      onClick={() => {
                        setMoreMenuOpen(false);
                        setShowFormSettings(true);
                      }}
                    >
                      <span className="actions-menu-icon">
                        <SettingsIcon />
                      </span>
                      Form settings
                    </button>
                  </li>
                  {isLive ? (
                    <li>
                      <button
                        type="button"
                        className="actions-menu-item actions-menu-item--danger"
                        onClick={() => {
                          setMoreMenuOpen(false);
                          void handleTakeOffline();
                        }}
                        disabled={isWorkflowBusy}
                      >
                        <span className="actions-menu-icon">
                          <TakeOfflineIcon />
                        </span>
                        <span className="actions-menu-item-text">
                          {isWorkflowBusy ? 'Taking offline…' : 'Take offline'}
                          <span className="actions-menu-item-hint">
                            Stops the public link from working
                          </span>
                        </span>
                      </button>
                    </li>
                  ) : null}
                </ul>
              </DropdownMenu>
            </div>
            {/* Two distinct modes, never blended: locked (view) shows Edit + Publish side
                by side — the canvas is read-only either way, so both are always safe to
                offer together; editing shows Save + Cancel instead, and nothing else,
                since that's the only thing to do until the session ends one way or the
                other. */}
            {isEditing ? (
              <div className="builder-header-stage">
                <button
                  type="button"
                  className="button button--ghost button--small"
                  onClick={handleCancelEditing}
                  disabled={isSaveBusy}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="button builder-header-cta"
                  onClick={() => void handleSaveAndClose()}
                  disabled={isSaveBusy}
                >
                  {isSaveBusy ? 'Saving…' : hasUnsavedChanges ? 'Save' : 'Done'}
                </button>
              </div>
            ) : (
              <div className="builder-header-stage">
                <span className="builder-edit-tooltip-wrap">
                  <button
                    type="button"
                    className="button builder-header-cta"
                    onClick={handleEditClick}
                    disabled={isWorkflowBusy}
                  >
                    <EditFormIcon />
                    Edit
                  </button>
                  {isLive ? (
                    <span className="builder-edit-tooltip" role="tooltip">
                      Takes the form offline so you can edit it
                    </span>
                  ) : null}
                </span>
                {workflowStep ? (
                  <button
                    type="button"
                    className={
                      canRunWorkflow
                        ? 'button builder-header-cta builder-header-cta--publish'
                        : 'button button--ghost button--small'
                    }
                    onClick={() => void handleWorkflowAction()}
                    disabled={isWorkflowBusy || !canRunWorkflow}
                  >
                    {isWorkflowBusy ? workflowStep.busyLabel : workflowStep.label}
                    {!isWorkflowBusy && canRunWorkflow ? <ArrowRightIcon /> : null}
                  </button>
                ) : null}
              </div>
            )}
          </>
        ) : null}
      </header>

      <div className="builder">
        <DndContext
          id="form-builder-dnd"
          sensors={sensors}
          collisionDetection={collisionDetection}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={() => setActiveDrag(null)}
        >
          <div
            className={`builder-workspace ${canEditCanvas ? '' : 'builder-workspace--readonly'}`}
          >
            {canEditCanvas ? (
              <aside
                className="builder-palette"
                aria-label={
                  activeRailTab === 'design'
                    ? 'Design'
                    : activeRailTab === 'logic'
                      ? 'Logic'
                      : editingField
                        ? 'Field settings'
                        : 'Field types'
                }
              >
                <BuilderRail activeTab={activeRailTab} onChangeTab={handleChangeRailTab} />
                <BuilderPanelScroll>
                  {activeRailTab === 'fields' ? (
                    editingField ? (
                      <div className="field-settings-aside">
                        <div className="field-settings-aside-header">
                          <span className="field-settings-aside-title">Field</span>
                          {!isEditingColumnChild ? (
                            <button
                              type="button"
                              className="button button--ghost button--small"
                              onClick={() => handleDuplicateField(editingField.id)}
                            >
                              Duplicate
                            </button>
                          ) : null}
                          <button
                            type="button"
                            className="field-settings-aside-back"
                            onClick={handleCloseFieldModal}
                            aria-label="Deselect field"
                          >
                            <CloseIcon />
                          </button>
                        </div>
                        <FieldSettingsPanel
                          formId={formId}
                          schema={schema}
                          field={editingField}
                          canEdit={canEditCanvas}
                          onUpdateField={handleUpdateField}
                          onReplaceFieldType={handleReplaceFieldType}
                          onSetColumnLayoutColumns={handleSetColumnLayoutColumns}
                        />
                      </div>
                    ) : (
                      <FieldPalette
                        onAddField={(type) => handleAddField(type)}
                        onAddColumnLayout={(columns) => handleAddColumnLayout(columns)}
                      />
                    )
                  ) : activeRailTab === 'design' ? (
                    <div className="field-settings-aside">
                      <div className="field-settings-aside-header">
                        <span className="field-settings-aside-title">Design</span>
                      </div>
                      <div className="settings-panel">
                        <DesignSettingsPanel
                          branding={schema.branding}
                          canEdit={canEditCanvas}
                          onUpdateBranding={handleUpdateBranding}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="field-settings-aside">
                      <div className="field-settings-aside-header">
                        <span className="field-settings-aside-title">
                          {logicField ? `Logic — ${logicField.label || 'Untitled field'}` : 'Logic'}
                        </span>
                      </div>
                      {logicField ? (
                        <div className="settings-panel">
                          <ConditionalLogicEditor
                            schema={schema}
                            field={logicField}
                            canEdit={canEditCanvas}
                            onSetRule={handleSetConditionalRule}
                            onClearRule={() => handleClearConditionalRule(logicField.id)}
                          />
                        </div>
                      ) : (
                        <div className="settings-panel settings-panel--empty">
                          <div className="settings-panel-empty-state">
                            <p className="settings-panel-empty-title">No field selected</p>
                            <p className="settings-panel-empty">
                              Click a field on the canvas to add conditional logic to it.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </BuilderPanelScroll>
              </aside>
            ) : null}

            <div className="builder-canvas-column">
              <ConditionalPreviewBar
                schema={schema}
                mockAnswers={mockAnswers}
                onChangeAnswer={handleChangeMockAnswer}
              />

              {activePage ? (
                <Canvas
                  formId={formId}
                  formName={formName}
                  branding={schema.branding}
                  page={activePage}
                  pageIndex={activePageIndex}
                  pageCount={schema.pages.length}
                  fields={schema.fields}
                  selectedFieldId={selectedFieldId}
                  onSelectField={handleSelectField}
                  onEditFieldDetails={handleEditFieldDetails}
                  onRemoveField={handleRemoveField}
                  onDuplicateField={handleDuplicateField}
                  onMoveField={handleMoveField}
                  onAddField={(type, index) => handleAddField(type, index)}
                  onAddColumnField={handleAddColumnField}
                  onUpdateField={handleUpdateField}
                  canEdit={canEditCanvas}
                  visibleFieldIds={visibleFieldIds}
                  fieldIdsWithRules={fieldIdsWithRules}
                />
              ) : (
                <div className="builder-canvas-empty">
                  <p>No page selected.</p>
                </div>
              )}
            </div>

            {canEditCanvas ? (
              <div className="builder-mobile-add">
                {activePage && activePage.fields.length === 0 ? (
                  <span className="builder-mobile-add-hint">Tap to add a field</span>
                ) : null}
                <button
                  type="button"
                  className="builder-mobile-add-fab"
                  onClick={() => setShowMobilePalette(true)}
                  aria-label="Add a field"
                >
                  <PlusIcon />
                </button>
              </div>
            ) : null}
          </div>

          <DragOverlay>
            {activeDrag?.source === 'palette' ? (
              <div className="drag-overlay-chip">{activeDrag.label}</div>
            ) : dragOverlayField ? (
              <FieldDragOverlay field={dragOverlayField} fields={schema.fields} formId={formId} />
            ) : null}
          </DragOverlay>
        </DndContext>

        {editingField ? (
          // Desktop editing now happens in-place in .builder-palette (see the aside above) —
          // this modal only still renders because .builder-palette is hidden below 900px
          // (see .builder-mobile-add's comment), so mobile still needs a way to reach a
          // field's settings. modal-overlay--mobile-only keeps it display:none above that
          // breakpoint so the two edit surfaces never show at once.
          // biome-ignore lint/a11y/noStaticElementInteractions: click-outside-to-dismiss backdrop; the modal has a keyboard-reachable Close button
          <div
            className="modal-overlay modal-overlay--mobile-only"
            onMouseDown={handleCloseFieldModal}
          >
            <div
              className="modal-card modal-card--wide"
              role="dialog"
              aria-modal="true"
              aria-labelledby="field-settings-modal-title"
              onMouseDown={(event) => event.stopPropagation()}
            >
              <div className="modal-header">
                <h2 className="modal-title" id="field-settings-modal-title">
                  Edit field
                </h2>
                <div className="modal-header-actions">
                  <span className="modal-header-badge">{FIELD_TYPE_LABELS[editingField.type]}</span>
                  {canEditCanvas && !isEditingColumnChild ? (
                    <button
                      type="button"
                      className="button button--ghost button--small"
                      onClick={() => handleDuplicateField(editingField.id)}
                    >
                      Duplicate
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="modal-close"
                    onClick={handleCloseFieldModal}
                    aria-label="Close"
                  >
                    ×
                  </button>
                </div>
              </div>
              <FieldSettingsPanel
                formId={formId}
                schema={schema}
                field={editingField}
                canEdit={canEditCanvas}
                onUpdateField={handleUpdateField}
                onReplaceFieldType={handleReplaceFieldType}
                onSetColumnLayoutColumns={handleSetColumnLayoutColumns}
              />
              {editingField.type !== 'hidden' ? (
                <div className="settings-section">
                  <p className="settings-section-title">Logic</p>
                  <ConditionalLogicEditor
                    schema={schema}
                    field={editingField}
                    canEdit={canEditCanvas}
                    onSetRule={handleSetConditionalRule}
                    onClearRule={() => handleClearConditionalRule(editingField.id)}
                  />
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        {showEditConfirm ? (
          // biome-ignore lint/a11y/noStaticElementInteractions: click-outside-to-dismiss backdrop; Escape/Cancel/Close buttons are also wired up
          <div
            className="modal-overlay"
            onMouseDown={() => !isWorkflowBusy && setShowEditConfirm(false)}
          >
            <div
              className="modal-card"
              role="dialog"
              aria-modal="true"
              aria-labelledby="edit-form-confirm-title"
              onMouseDown={(event) => event.stopPropagation()}
            >
              <div className="modal-header">
                <h2 className="modal-title" id="edit-form-confirm-title">
                  Edit this form?
                </h2>
                <button
                  type="button"
                  className="modal-close"
                  onClick={() => setShowEditConfirm(false)}
                  aria-label="Close"
                  disabled={isWorkflowBusy}
                >
                  ×
                </button>
              </div>

              <p className="modal-body-text">
                This form is live. Editing it will take it offline for new visitors — the public
                link stops working until you publish again.
              </p>
              <p className="modal-body-text">
                Anyone already filling it out can still finish and submit their response.
              </p>

              <div className="modal-footer">
                <button
                  type="button"
                  className="button button--secondary"
                  onClick={() => setShowEditConfirm(false)}
                  disabled={isWorkflowBusy}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="button button--dark"
                  onClick={() => void handleConfirmEditForm()}
                  disabled={isWorkflowBusy}
                >
                  {isWorkflowBusy ? 'Taking offline…' : 'Take offline & edit'}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {showMobilePalette ? (
          // biome-ignore lint/a11y/noStaticElementInteractions: click-outside-to-dismiss backdrop; the modal has a keyboard-reachable Close button
          <div className="modal-overlay" onMouseDown={() => setShowMobilePalette(false)}>
            <div
              className="modal-card builder-mobile-palette-card"
              role="dialog"
              aria-modal="true"
              aria-labelledby="mobile-palette-modal-title"
              onMouseDown={(event) => event.stopPropagation()}
            >
              <div className="modal-header">
                <h2 className="modal-title" id="mobile-palette-modal-title">
                  Add a field
                </h2>
                <div className="modal-header-actions">
                  <button
                    type="button"
                    className="modal-close"
                    onClick={() => setShowMobilePalette(false)}
                    aria-label="Close"
                  >
                    ×
                  </button>
                </div>
              </div>
              <FieldPalette
                onAddField={(type) => {
                  handleAddField(type);
                  setShowMobilePalette(false);
                }}
                onAddColumnLayout={(columns) => {
                  handleAddColumnLayout(columns);
                  setShowMobilePalette(false);
                }}
              />
            </div>
          </div>
        ) : null}

        {showFormSettings ? (
          // biome-ignore lint/a11y/noStaticElementInteractions: click-outside-to-dismiss backdrop; the modal has a keyboard-reachable Close button
          <div className="modal-overlay" onMouseDown={() => setShowFormSettings(false)}>
            <div
              className="modal-card"
              role="dialog"
              aria-modal="true"
              aria-labelledby="form-settings-modal-title"
              onMouseDown={(event) => event.stopPropagation()}
            >
              <div className="modal-header">
                <h2 className="modal-title" id="form-settings-modal-title">
                  Form settings
                </h2>
                <div className="modal-header-actions">
                  <button
                    type="button"
                    className="modal-close"
                    onClick={() => setShowFormSettings(false)}
                    aria-label="Close"
                  >
                    ×
                  </button>
                </div>
              </div>
              <DesignSettingsPanel
                branding={schema.branding}
                canEdit={canEditCanvas}
                onUpdateBranding={handleUpdateBranding}
              />
            </div>
          </div>
        ) : null}
      </div>
    </>
  );
}
