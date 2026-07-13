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
import { useFormWorkspaceStatus } from '@/app/forms/[id]/form-workspace-context';
import { useToast } from '@/components/toast';
import { extractApiError, getErrorMessage } from '@/lib/error-message';
import type { FormAnswers } from '@/lib/forms/conditional-logic';
import { getVisibleFieldIds } from '@/lib/forms/conditional-logic';
import { FORM_STATUS_BADGE_CLASS, FORM_STATUS_LABEL } from '@/lib/forms/form-status';
import {
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
import {
  createEmptyFormSchema,
  DEFAULT_FORM_PRIMARY_COLOR,
  DEFAULT_SUBMIT_BUTTON_TEXT,
  formSchemaSchema,
  SUBMIT_BUTTON_SIZE_LABEL,
  SUBMIT_BUTTON_SIZE_OPTIONS,
  TEXT_ALIGN_LABEL,
  TEXT_ALIGN_OPTIONS,
} from '@/lib/forms/schema';

interface VersionMeta {
  id: string;
  versionNumber: number;
  publishedAt: string | null;
}

interface BuilderClientProps {
  formId: string;
  formName: string;
  initialVersion: (VersionMeta & { schema: FormSchema }) | null;
  canEdit: boolean;
}

type SaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error';

interface DragPayload {
  source?: 'palette';
  fieldType?: FieldType;
  columnLayoutColumns?: ColumnCount;
}

function SaveStatusBadge({ status, error }: { status: SaveStatus; error: string | null }) {
  switch (status) {
    case 'pending':
      return <span className="builder-save-status builder-save-status--pending">Unsaved</span>;
    case 'saving':
      return <span className="builder-save-status">Saving…</span>;
    case 'saved':
      return <span className="builder-save-status builder-save-status--saved">Saved</span>;
    case 'error':
      return (
        <span className="builder-save-status builder-save-status--error" title={error ?? undefined}>
          Save failed
        </span>
      );
    default:
      return null;
  }
}

export function BuilderClient({
  formId,
  formName: _formName,
  initialVersion,
  canEdit,
}: BuilderClientProps) {
  const toast = useToast();
  const { status: formStatus, setStatus: setFormStatus } = useFormWorkspaceStatus();
  const [schema, setSchema] = useState<FormSchema>(
    initialVersion?.schema ?? createEmptyFormSchema(),
  );
  const [version, setVersion] = useState<VersionMeta | null>(
    initialVersion
      ? {
          id: initialVersion.id,
          versionNumber: initialVersion.versionNumber,
          publishedAt: initialVersion.publishedAt,
        }
      : null,
  );
  const [activePageId, setActivePageId] = useState<string>(() => schema.pages[0]?.id ?? '');
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  // Which field's settings modal is open, if any — separate from selection so selecting a
  // field (to show its overlay on the canvas) doesn't itself pop the modal open.
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);
  const [showFormSettings, setShowFormSettings] = useState(false);
  const [mockAnswers, setMockAnswers] = useState<FormAnswers>({});
  const [activeDragLabel, setActiveDragLabel] = useState<string | null>(null);

  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isWorkflowBusy, setIsWorkflowBusy] = useState(false);

  const lastSavedSchemaJsonRef = useRef<string>(JSON.stringify(schema));
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSaveErrorToastRef = useRef<string | null>(null);

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

  const saveSchema = useCallback(
    async (schemaToSave: FormSchema, schemaJson: string): Promise<boolean> => {
      const parsed = formSchemaSchema.safeParse(schemaToSave);
      if (!parsed.success) {
        throw new Error('Form has validation errors — fix them before continuing');
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
        lastSavedSchemaJsonRef.current = schemaJson;
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
        setSaveStatus('saved');
        lastSaveErrorToastRef.current = null;
        return true;
      } catch (err) {
        const message = getErrorMessage(err, 'Failed to save changes');
        setSaveStatus('error');
        setSaveError(message);
        if (lastSaveErrorToastRef.current !== message) {
          toast.error(message);
          lastSaveErrorToastRef.current = message;
        }
        return false;
      }
    },
    [formId, setFormStatus, toast],
  );

  useEffect(() => {
    if (!canEdit) return;
    const schemaJson = JSON.stringify(schema);
    if (schemaJson === lastSavedSchemaJsonRef.current) return;

    setSaveStatus('pending');
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      void saveSchema(schema, schemaJson);
    }, 800);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [schema, canEdit, saveSchema]);

  async function ensureSaved() {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    const schemaJson = JSON.stringify(schema);
    if (schemaJson === lastSavedSchemaJsonRef.current) {
      return;
    }
    const saved = await saveSchema(schema, schemaJson);
    if (!saved) {
      throw new Error('Could not save changes');
    }
  }

  function applyWorkflowResult(body: FormWorkflowResult) {
    const nextStatus = body?.form?.status as FormStatus | undefined;
    if (!nextStatus) {
      throw new Error('Server did not return an updated form status');
    }
    setFormStatus(nextStatus);
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

  async function handleWorkflowAction() {
    const step = getWorkflowStepForStatus(formStatus);
    if (!step || !canEdit || !canRunWorkflow) return;

    setIsWorkflowBusy(true);
    try {
      await ensureSaved();
      const body = await runFormWorkflow(formId, step.action);
      applyWorkflowResult(body);

      const messages: Record<string, string> = {
        approve: 'Form approved — ready to publish',
        publish: `Published as v${body.version?.versionNumber ?? ''}`.trim(),
        unpublish: 'Form unpublished',
      };
      toast.success(messages[step.action] ?? 'Status updated');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Something went wrong'));
    } finally {
      setIsWorkflowBusy(false);
    }
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
    if (!canEdit) return;
    const field: FormField = createDefaultField(type);
    setSchema((prev) => addFieldToPage(prev, activePageId, field, index));
    setSelectedFieldId(field.id);
  }

  function handleAddColumnLayout(columns: ColumnCount, index?: number) {
    if (!canEdit) return;
    const { schema: next, layoutId } = addColumnLayoutToPage(schema, activePageId, columns, index);
    setSchema(next);
    setSelectedFieldId(layoutId);
  }

  function handleSetColumnLayoutColumns(layoutId: string, columns: ColumnCount) {
    if (!canEdit) return;
    setSchema((prev) => setColumnLayoutColumns(prev, layoutId, columns));
  }

  /** Fills an empty column slot with a freshly-created field of `type`, then selects it. */
  function handleAddColumnField(layoutId: string, slotIndex: number, type: FieldType) {
    if (!canEdit) return;
    const result = setColumnSlotField(schema, layoutId, slotIndex, type);
    if (!result) return;
    setSchema(result.schema);
    setSelectedFieldId(result.fieldId);
  }

  function handleRemoveField(fieldId: string) {
    if (!canEdit) return;
    setSchema((prev) => removeField(prev, fieldId));
    setSelectedFieldId((current) => (current === fieldId ? null : current));
    setEditingFieldId((current) => (current === fieldId ? null : current));
  }

  function handleReplaceFieldType(fieldId: string, type: FieldType) {
    if (!canEdit) return;
    setSchema((prev) => replaceFieldType(prev, fieldId, type));
  }

  function handleDuplicateField(fieldId: string) {
    if (!canEdit) return;
    const page = schema.pages.find((entry) => entry.id === activePageId);
    const index = page?.fields.indexOf(fieldId) ?? -1;
    const next = duplicateField(schema, activePageId, fieldId);
    const newFieldId =
      next.pages.find((entry) => entry.id === activePageId)?.fields[index + 1] ?? null;
    setSchema(next);
    if (newFieldId) setSelectedFieldId(newFieldId);
  }

  function handleUpdateField(fieldId: string, patch: FieldPatch) {
    if (!canEdit) return;
    setSchema((prev) => updateField(prev, fieldId, patch));
  }

  function handleUpdateBranding(patch: Partial<FormBranding>) {
    if (!canEdit) return;
    setSchema((prev) => ({ ...prev, branding: { ...prev.branding, ...patch } }));
  }

  function handleSetConditionalRule(rule: ConditionalRule) {
    if (!canEdit) return;
    setSchema((prev) => setConditionalRule(prev, rule));
  }

  function handleClearConditionalRule(fieldId: string) {
    if (!canEdit) return;
    setSchema((prev) => clearConditionalRule(prev, fieldId));
  }

  function handleAddPage() {
    if (!canEdit) return;
    const id = crypto.randomUUID();
    const page: FormPage = { id, title: `Page ${schema.pages.length + 1}`, fields: [] };
    setSchema((prev) => addPage(prev, page));
    setActivePageId(id);
    setSelectedFieldId(null);
  }

  function handleRemovePage(pageId: string) {
    if (!canEdit || schema.pages.length <= 1) return;
    setSchema((prev) => removePage(prev, pageId));
    if (activePageId === pageId) {
      const remaining = schema.pages.filter((page) => page.id !== pageId);
      const next = remaining[0];
      if (next) setActivePageId(next.id);
    }
    setSelectedFieldId(null);
  }

  function handleRenamePage(pageId: string, title: string) {
    if (!canEdit) return;
    setSchema((prev) => renamePage(prev, pageId, title));
  }

  function handleMovePage(pageId: string, direction: 'left' | 'right') {
    if (!canEdit) return;
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
    if (!canEdit) return;
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
    if (!canEdit) return;
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
  const editingField = editingFieldId ? (schema.fields[editingFieldId] ?? null) : null;

  const visibleFieldIds = useMemo(
    () => getVisibleFieldIds(schema, mockAnswers),
    [schema, mockAnswers],
  );
  const fieldIdsWithRules = useMemo(
    () => new Set(schema.conditionalLogic.map((rule) => rule.fieldId)),
    [schema.conditionalLogic],
  );

  const isSaveBusy = saveStatus === 'pending' || saveStatus === 'saving';
  const hasDraftVersion = version?.publishedAt === null;
  const workflowStep = getWorkflowStepForStatus(formStatus);
  const canRunWorkflow =
    workflowStep !== null &&
    !isSaveBusy &&
    (formStatus === 'draft'
      ? hasDraftVersion
      : formStatus === 'approved'
        ? version?.publishedAt !== null || hasDraftVersion
        : formStatus === 'published');
  const isLive = formStatus === 'published' && !isSaveBusy;

  return (
    <div className="builder">
      <header className="builder-header">
        <PageTabs
          pages={schema.pages}
          activePageId={activePage?.id ?? ''}
          canEdit={canEdit}
          onSelectPage={handleSelectPage}
          onAddPage={handleAddPage}
          onRemovePage={handleRemovePage}
          onRenamePage={handleRenamePage}
          onMovePage={handleMovePage}
        />
        <div className="builder-header-actions">
          {!canEdit ? <span className="builder-readonly-badge">Read-only</span> : null}
          {canEdit ? (
            <>
              <button
                type="button"
                className="button button--ghost"
                onClick={() => setShowFormSettings(true)}
              >
                Form settings
              </button>
              <SaveStatusBadge status={saveStatus} error={saveError} />
              <span className={`badge builder-status-badge ${FORM_STATUS_BADGE_CLASS[formStatus]}`}>
                {FORM_STATUS_LABEL[formStatus]}
              </span>
              {isLive ? <span className="builder-live-badge">Live</span> : null}
              {workflowStep ? (
                <button
                  type="button"
                  className={canRunWorkflow ? 'button' : 'button button--ghost'}
                  onClick={() => void handleWorkflowAction()}
                  disabled={isWorkflowBusy || !canRunWorkflow}
                >
                  {isWorkflowBusy ? workflowStep.busyLabel : workflowStep.label}
                </button>
              ) : null}
            </>
          ) : null}
        </div>
      </header>

      <DndContext
        id="form-builder-dnd"
        sensors={sensors}
        collisionDetection={collisionDetection}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className={`builder-workspace ${canEdit ? '' : 'builder-workspace--readonly'}`}>
          {canEdit ? (
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
                formId={formId}
                page={activePage}
                fields={schema.fields}
                selectedFieldId={selectedFieldId}
                onSelectField={handleSelectField}
                onEditFieldDetails={handleEditFieldDetails}
                onRemoveField={handleRemoveField}
                onDuplicateField={handleDuplicateField}
                onAddColumnField={handleAddColumnField}
                canEdit={canEdit}
                visibleFieldIds={visibleFieldIds}
                fieldIdsWithRules={fieldIdsWithRules}
              />
            ) : (
              <div className="builder-canvas-empty">
                <p>No page selected.</p>
              </div>
            )}
          </div>
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
              canEdit={canEdit}
              onUpdateField={handleUpdateField}
              onDuplicateField={handleDuplicateField}
              onReplaceFieldType={handleReplaceFieldType}
              onSetColumnLayoutColumns={handleSetColumnLayoutColumns}
              onSetConditionalRule={handleSetConditionalRule}
              onClearConditionalRule={handleClearConditionalRule}
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
            <div className="settings-section">
              <p className="settings-section-title">Form title</p>
              <label className="settings-toggle-row">
                <span className="settings-label">Show form title</span>
                <input
                  type="checkbox"
                  checked={schema.branding.showTitle === true}
                  disabled={!canEdit}
                  onChange={(event) => handleUpdateBranding({ showTitle: event.target.checked })}
                />
              </label>
              {schema.branding.showTitle === true ? (
                <div className="settings-width-options">
                  {TEXT_ALIGN_OPTIONS.map((align) => (
                    <label key={align} className="settings-width-option">
                      <input
                        type="radio"
                        name="form-title-align"
                        checked={(schema.branding.titleAlign ?? 'center') === align}
                        disabled={!canEdit}
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
                  disabled={!canEdit}
                  onChange={(event) =>
                    handleUpdateBranding({ submitButtonText: event.target.value || undefined })
                  }
                />
              </label>
              <FieldColorPicker
                label="Button color"
                value={schema.branding.submitButtonColor}
                defaultColor={DEFAULT_FORM_PRIMARY_COLOR}
                canEdit={canEdit}
                onChange={(color) => handleUpdateBranding({ submitButtonColor: color })}
              />
              <FieldColorPicker
                label="Text color"
                value={schema.branding.submitButtonTextColor}
                defaultColor="#ffffff"
                canEdit={canEdit}
                onChange={(color) => handleUpdateBranding({ submitButtonTextColor: color })}
              />
              <p className="settings-section-title">Alignment</p>
              <div className="settings-width-options">
                {TEXT_ALIGN_OPTIONS.map((align) => (
                  <label key={align} className="settings-width-option">
                    <input
                      type="radio"
                      name="submit-button-align"
                      checked={(schema.branding.submitButtonAlign ?? 'center') === align}
                      disabled={!canEdit}
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
                      name="submit-button-size"
                      checked={(schema.branding.submitButtonSize ?? 'medium') === size}
                      disabled={!canEdit}
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
  );
}
