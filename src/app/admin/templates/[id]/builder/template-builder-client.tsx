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
import Link from 'next/link';
import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CANVAS_DROPPABLE_ID, Canvas } from '@/app/forms/[id]/builder/canvas';
import { ConditionalPreviewBar } from '@/app/forms/[id]/builder/conditional-preview-bar';
import { parseColumnSlotDroppableId } from '@/app/forms/[id]/builder/field-card';
import { FieldColorPicker } from '@/app/forms/[id]/builder/field-color-picker';
import {
  COLUMN_LAYOUT_LABELS,
  createDefaultField,
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
import { useToast } from '@/components/toast';
import { extractApiError, getErrorMessage } from '@/lib/error-message';
import type { FormAnswers } from '@/lib/forms/conditional-logic';
import { getVisibleFieldIds } from '@/lib/forms/conditional-logic';
import type {
  ColumnCount,
  ConditionalRule,
  FieldType,
  FormBranding,
  FormField,
  FormPage,
  FormSchema,
} from '@/lib/forms/schema';
import {
  DEFAULT_FORM_PRIMARY_COLOR,
  DEFAULT_SUBMIT_BUTTON_TEXT,
  formSchemaSchema,
  SUBMIT_BUTTON_SIZE_LABEL,
  SUBMIT_BUTTON_SIZE_OPTIONS,
  TEXT_ALIGN_LABEL,
  TEXT_ALIGN_OPTIONS,
} from '@/lib/forms/schema';

// A trimmed, standalone sibling of src/app/forms/[id]/builder/builder-client.tsx — same
// Canvas/FieldPalette/FieldSettingsPanel/PageTabs/schema-mutations pieces (the actual
// drag-and-drop field editor), but with every form-workflow concept stripped out:
// no FormVersion history, no publish/unpublish, no "live" edit-gate confirmation. A
// FormTemplate is a single row with one current schema (see its doc comment in
// prisma/schema.prisma) — "using" it always produces a fresh Form/FormVersion for the
// organisation, so there's nothing here that's ever "live" to protect against editing.
// Deliberately NOT a shared component with BuilderClient: that file is tightly coupled
// to form workflow/versioning/live-status via useFormWorkspaceStatus, and threading a
// second "mode" through it would risk destabilizing the org-facing builder for the sake
// of this admin-only screen.
//
// Known limitation: the "image" content-block field type's upload control (in
// FieldSettingsPanel) posts to /api/forms/{formId}/fields/{fieldId}/image, which only
// exists for real forms — there's no template-scoped equivalent yet. The field type
// still works structurally (add it, set its label/required/width), it just can't have
// an image uploaded into it from here yet. Low priority: templates rarely need a
// pre-baked static image, since the organisation using the template can add their own
// after copying it.

interface TemplateBuilderClientProps {
  templateId: string;
  initialSchema: FormSchema;
}

type SaveStatus = 'idle' | 'saving' | 'error';

interface DragPayload {
  source?: 'palette';
  fieldType?: FieldType;
  columnLayoutColumns?: ColumnCount;
}

function PlusIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M10 4v12M4 10h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
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

function PreviewIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M1.5 8s2.5-4 6.5-4 6.5 4 6.5 4-2.5 4-6.5 4-6.5-4-6.5-4Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <circle cx="8" cy="8" r="1.75" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

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

export function TemplateBuilderClient({ templateId, initialSchema }: TemplateBuilderClientProps) {
  const toast = useToast();
  const [schema, setSchema] = useState<FormSchema>(initialSchema);
  const [isEditing, setIsEditing] = useState(false);
  const [activePageId, setActivePageId] = useState<string>(() => schema.pages[0]?.id ?? '');
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);
  const [showTemplateSettings, setShowTemplateSettings] = useState(false);
  const [showMobilePalette, setShowMobilePalette] = useState(false);
  const [mockAnswers, setMockAnswers] = useState<FormAnswers>({});
  const [activeDragLabel, setActiveDragLabel] = useState<string | null>(null);

  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);

  const lastSavedSchemaJsonRef = useRef<string>(JSON.stringify(schema));

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const collisionDetection: CollisionDetection = useCallback((args) => {
    const pointerHits = pointerWithin(args);
    const pointerFields = pointerHits.filter(({ id }) => id !== CANVAS_DROPPABLE_ID);
    if (pointerFields.length > 0) return pointerFields;
    if (pointerHits.length > 0) return pointerHits;

    const centerHits = closestCenter(args);
    const centerFields = centerHits.filter(({ id }) => id !== CANVAS_DROPPABLE_ID);
    return centerFields.length > 0 ? centerFields : centerHits;
  }, []);

  const saveSchema = useCallback(async (): Promise<boolean> => {
    const parsed = formSchemaSchema.safeParse(schema);
    if (!parsed.success) {
      const message = 'Template has validation errors — fix them before saving';
      setSaveStatus('error');
      setSaveError(message);
      toast.error(message);
      return false;
    }

    setSaveStatus('saving');
    setSaveError(null);
    try {
      const response = await fetch(`/api/admin/form-templates/${templateId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schema: parsed.data }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(extractApiError(body, 'Failed to save changes'));
      }
      lastSavedSchemaJsonRef.current = JSON.stringify(schema);
      setSaveStatus('idle');
      return true;
    } catch (err) {
      const message = getErrorMessage(err, 'Failed to save changes');
      setSaveStatus('error');
      setSaveError(message);
      toast.error(message);
      return false;
    }
  }, [schema, templateId, toast]);

  async function handleSaveAndClose() {
    if (hasUnsavedChanges) {
      const saved = await saveSchema();
      if (!saved) return;
      toast.success('Template saved');
    }
    setIsEditing(false);
  }

  function handleCancelEditing() {
    if (hasUnsavedChanges) {
      const confirmed = window.confirm(
        'Discard your unsaved changes to this template? This cannot be undone.',
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
  }

  function handleEditFieldDetails(fieldId: string) {
    setSelectedFieldId(fieldId);
    setEditingFieldId(fieldId);
  }

  function handleCloseFieldModal() {
    setEditingFieldId(null);
  }

  function handleAddField(type: FieldType, index?: number) {
    if (!isEditing) return;
    const field: FormField = createDefaultField(type);
    setSchema((prev) => addFieldToPage(prev, activePageId, field, index));
    setSelectedFieldId(field.id);
  }

  function handleAddColumnLayout(columns: ColumnCount, index?: number) {
    if (!isEditing) return;
    const { schema: next, layoutId } = addColumnLayoutToPage(schema, activePageId, columns, index);
    setSchema(next);
    setSelectedFieldId(layoutId);
  }

  function handleSetColumnLayoutColumns(layoutId: string, columns: ColumnCount) {
    if (!isEditing) return;
    setSchema((prev) => setColumnLayoutColumns(prev, layoutId, columns));
  }

  function handleAddColumnField(layoutId: string, slotIndex: number, type: FieldType) {
    if (!isEditing) return;
    const result = setColumnSlotField(schema, layoutId, slotIndex, type);
    if (!result) return;
    setSchema(result.schema);
    setSelectedFieldId(result.fieldId);
  }

  function handleRemoveField(fieldId: string) {
    if (!isEditing) return;
    setSchema((prev) => removeField(prev, fieldId));
    setSelectedFieldId((current) => (current === fieldId ? null : current));
    setEditingFieldId((current) => (current === fieldId ? null : current));
  }

  function handleReplaceFieldType(fieldId: string, type: FieldType) {
    if (!isEditing) return;
    setSchema((prev) => replaceFieldType(prev, fieldId, type));
  }

  function handleDuplicateField(fieldId: string) {
    if (!isEditing) return;
    const page = schema.pages.find((entry) => entry.id === activePageId);
    const index = page?.fields.indexOf(fieldId) ?? -1;
    const next = duplicateField(schema, activePageId, fieldId);
    const newFieldId =
      next.pages.find((entry) => entry.id === activePageId)?.fields[index + 1] ?? null;
    setSchema(next);
    if (newFieldId) setSelectedFieldId(newFieldId);
  }

  function handleUpdateField(fieldId: string, patch: FieldPatch) {
    if (!isEditing) return;
    setSchema((prev) => updateField(prev, fieldId, patch));
  }

  function handleUpdateBranding(patch: Partial<FormBranding>) {
    if (!isEditing) return;
    setSchema((prev) => ({ ...prev, branding: { ...prev.branding, ...patch } }));
  }

  function handleSetConditionalRule(rule: ConditionalRule) {
    if (!isEditing) return;
    setSchema((prev) => setConditionalRule(prev, rule));
  }

  function handleClearConditionalRule(fieldId: string) {
    if (!isEditing) return;
    setSchema((prev) => clearConditionalRule(prev, fieldId));
  }

  function handleAddPage() {
    if (!isEditing) return;
    const id = crypto.randomUUID();
    const page: FormPage = { id, title: `Page ${schema.pages.length + 1}`, fields: [] };
    setSchema((prev) => addPage(prev, page));
    setActivePageId(id);
    setSelectedFieldId(null);
  }

  function handleRemovePage(pageId: string) {
    if (!isEditing || schema.pages.length <= 1) return;
    setSchema((prev) => removePage(prev, pageId));
    if (activePageId === pageId) {
      const remaining = schema.pages.filter((page) => page.id !== pageId);
      const next = remaining[0];
      if (next) setActivePageId(next.id);
    }
    setSelectedFieldId(null);
  }

  function handleRenamePage(pageId: string, title: string) {
    if (!isEditing) return;
    setSchema((prev) => renamePage(prev, pageId, title));
  }

  function handleMovePage(pageId: string, direction: 'left' | 'right') {
    if (!isEditing) return;
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
    if (!isEditing) return;
    const data = event.active.data.current as DragPayload | undefined;
    if (data?.source === 'palette' && data.columnLayoutColumns) {
      setActiveDragLabel(COLUMN_LAYOUT_LABELS[data.columnLayoutColumns]);
      return;
    }
    if (data?.source === 'palette' && data.fieldType) {
      setActiveDragLabel(FIELD_TYPE_LABELS[data.fieldType]);
      return;
    }
    const field = schema.fields[event.active.id.toString()];
    setActiveDragLabel(field?.label ?? null);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveDragLabel(null);
    if (!isEditing) return;
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
      const slot = parseColumnSlotDroppableId(overId);
      if (slot && isColumnChildFieldType(data.fieldType)) {
        handleAddColumnField(slot.layoutId, slot.slotIndex, data.fieldType);
        return;
      }
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
  const isEditingColumnChild = editingField
    ? Boolean(findParentColumnLayout(schema, editingField.id))
    : false;

  const visibleFieldIds = useMemo(
    () => getVisibleFieldIds(schema, mockAnswers),
    [schema, mockAnswers],
  );
  const fieldIdsWithRules = useMemo(
    () => new Set(schema.conditionalLogic.map((rule) => rule.fieldId)),
    [schema.conditionalLogic],
  );

  const isSaveBusy = saveStatus === 'saving';
  const hasUnsavedChanges = JSON.stringify(schema) !== lastSavedSchemaJsonRef.current;

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
    <div className="template-builder-page">
      <header className="builder-header">
        <SaveStatusBadge
          status={saveStatus}
          hasUnsavedChanges={hasUnsavedChanges}
          error={saveError}
        />
        <PageTabs
          pages={schema.pages}
          activePageId={activePage?.id ?? ''}
          canEdit={isEditing}
          onSelectPage={handleSelectPage}
          onAddPage={handleAddPage}
          onRemovePage={handleRemovePage}
          onRenamePage={handleRenamePage}
          onMovePage={handleMovePage}
        />
        <div className="builder-header-utility">
          {/* Opens the last-saved schema (same route the org-side gallery uses, via the
              isPlatformAdmin bypass in template-preview/[id]/page.tsx), not whatever's
              currently unsaved in the canvas — matches how the org form builder's own
              Preview link works (form-top-nav.tsx), which is also last-saved, not live. */}
          <Link
            href={`/template-preview/${templateId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="button button--ghost button--small"
          >
            <PreviewIcon /> Preview
          </Link>
          <button
            type="button"
            className="button button--ghost button--small"
            onClick={() => setShowTemplateSettings(true)}
          >
            <SettingsIcon /> Settings
          </button>
        </div>
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
            <button
              type="button"
              className="button builder-header-cta"
              onClick={() => setIsEditing(true)}
            >
              <EditFormIcon />
              Edit
            </button>
          </div>
        )}
      </header>

      <div className="builder">
        <DndContext
          id="template-builder-dnd"
          sensors={sensors}
          collisionDetection={collisionDetection}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className={`builder-workspace ${isEditing ? '' : 'builder-workspace--readonly'}`}>
            {isEditing ? (
              <aside className="builder-palette" aria-label="Field types">
                <FieldPalette
                  onAddField={(type) => handleAddField(type)}
                  onAddColumnLayout={(columns) => handleAddColumnLayout(columns)}
                />
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
                  formId={templateId}
                  page={activePage}
                  pageIndex={activePageIndex}
                  pageCount={schema.pages.length}
                  fields={schema.fields}
                  selectedFieldId={selectedFieldId}
                  onSelectField={handleSelectField}
                  onEditFieldDetails={handleEditFieldDetails}
                  onRemoveField={handleRemoveField}
                  onDuplicateField={handleDuplicateField}
                  onAddField={(type) => handleAddField(type)}
                  onAddColumnField={handleAddColumnField}
                  onUpdateField={handleUpdateField}
                  canEdit={isEditing}
                  visibleFieldIds={visibleFieldIds}
                  fieldIdsWithRules={fieldIdsWithRules}
                />
              ) : (
                <div className="builder-canvas-empty">
                  <p>No page selected.</p>
                </div>
              )}
            </div>

            {isEditing ? (
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
            {activeDragLabel ? <div className="drag-overlay-chip">{activeDragLabel}</div> : null}
          </DragOverlay>
        </DndContext>

        {editingField ? (
          // biome-ignore lint/a11y/noStaticElementInteractions: click-outside-to-dismiss backdrop; the modal has a keyboard-reachable Close button
          <div className="modal-overlay" onMouseDown={handleCloseFieldModal}>
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
                  {isEditing && !isEditingColumnChild ? (
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
                formId={templateId}
                schema={schema}
                field={editingField}
                canEdit={isEditing}
                onUpdateField={handleUpdateField}
                onReplaceFieldType={handleReplaceFieldType}
                onSetColumnLayoutColumns={handleSetColumnLayoutColumns}
                onSetConditionalRule={handleSetConditionalRule}
                onClearConditionalRule={handleClearConditionalRule}
              />
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

        {showTemplateSettings ? (
          // biome-ignore lint/a11y/noStaticElementInteractions: click-outside-to-dismiss backdrop; the modal has a keyboard-reachable Close button
          <div className="modal-overlay" onMouseDown={() => setShowTemplateSettings(false)}>
            <div
              className="modal-card"
              role="dialog"
              aria-modal="true"
              aria-labelledby="template-settings-modal-title"
              onMouseDown={(event) => event.stopPropagation()}
            >
              <div className="modal-header">
                <h2 className="modal-title" id="template-settings-modal-title">
                  Form settings
                </h2>
                <div className="modal-header-actions">
                  <button
                    type="button"
                    className="modal-close"
                    onClick={() => setShowTemplateSettings(false)}
                    aria-label="Close"
                  >
                    ×
                  </button>
                </div>
              </div>
              <div className="settings-section">
                <p className="settings-section-title">Form title</p>
                <label className="settings-toggle-row">
                  <span className="settings-label">Show form title</span>
                  <input
                    type="checkbox"
                    checked={schema.branding.showTitle === true}
                    disabled={!isEditing}
                    onChange={(event) => handleUpdateBranding({ showTitle: event.target.checked })}
                  />
                </label>
                {schema.branding.showTitle === true ? (
                  <div className="settings-width-options">
                    {TEXT_ALIGN_OPTIONS.map((align) => (
                      <label key={align} className="settings-width-option">
                        <input
                          type="radio"
                          name="template-title-align"
                          checked={(schema.branding.titleAlign ?? 'center') === align}
                          disabled={!isEditing}
                          onChange={() => handleUpdateBranding({ titleAlign: align })}
                        />
                        {TEXT_ALIGN_LABEL[align]}
                      </label>
                    ))}
                  </div>
                ) : null}
              </div>
              <div className="settings-section">
                <p className="settings-section-title">Submit button</p>
                <label className="settings-field">
                  <span className="settings-label">Button text</span>
                  <input
                    type="text"
                    className="text-input"
                    value={schema.branding.submitButtonText ?? ''}
                    placeholder={DEFAULT_SUBMIT_BUTTON_TEXT}
                    disabled={!isEditing}
                    onChange={(event) =>
                      handleUpdateBranding({ submitButtonText: event.target.value || undefined })
                    }
                  />
                </label>
                <FieldColorPicker
                  label="Button color"
                  value={schema.branding.submitButtonColor}
                  defaultColor={DEFAULT_FORM_PRIMARY_COLOR}
                  canEdit={isEditing}
                  onChange={(color) => handleUpdateBranding({ submitButtonColor: color })}
                />
                <FieldColorPicker
                  label="Text color"
                  value={schema.branding.submitButtonTextColor}
                  defaultColor="#ffffff"
                  canEdit={isEditing}
                  onChange={(color) => handleUpdateBranding({ submitButtonTextColor: color })}
                />
                <p className="settings-section-title">Alignment</p>
                <div className="settings-width-options">
                  {TEXT_ALIGN_OPTIONS.map((align) => (
                    <label key={align} className="settings-width-option">
                      <input
                        type="radio"
                        name="template-submit-button-align"
                        checked={(schema.branding.submitButtonAlign ?? 'center') === align}
                        disabled={!isEditing}
                        onChange={() => handleUpdateBranding({ submitButtonAlign: align })}
                      />
                      {TEXT_ALIGN_LABEL[align]}
                    </label>
                  ))}
                </div>
                <p className="settings-section-title">Size</p>
                <div className="settings-width-options">
                  {SUBMIT_BUTTON_SIZE_OPTIONS.map((size) => (
                    <label key={size} className="settings-width-option">
                      <input
                        type="radio"
                        name="template-submit-button-size"
                        checked={(schema.branding.submitButtonSize ?? 'medium') === size}
                        disabled={!isEditing}
                        onChange={() => handleUpdateBranding({ submitButtonSize: size })}
                      />
                      {SUBMIT_BUTTON_SIZE_LABEL[size]}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
