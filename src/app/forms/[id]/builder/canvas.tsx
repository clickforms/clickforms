'use client';

import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { FieldCard } from '@/app/forms/[id]/builder/field-card';
import { FIELD_TYPE_LABELS } from '@/app/forms/[id]/builder/field-meta';
import { PaletteIcon } from '@/app/forms/[id]/builder/field-palette';
import type { FieldPatch } from '@/app/forms/[id]/builder/schema-mutations';
import type { FieldType, FormBranding, FormField, FormPage } from '@/lib/forms/schema';

export const CANVAS_DROPPABLE_ID = 'canvas-dropzone';

/** Quick-add pills shown in the empty-page state — a fast path into the most commonly
 * reached-for field types, for anyone who'd rather tap than drag from the palette. */
const QUICK_ADD_TYPES: FieldType[] = ['short_text', 'section_break', 'multi_choice', 'image'];

/** Layout chrome that doesn't get a "1. Question" number on the canvas. Column layouts
 * still number because they carry a question label of their own (see the screenshot
 * "2. Type your text here" grid). */
function isNumberedCanvasField(field: FormField | undefined): boolean {
  if (!field) return false;
  switch (field.type) {
    case 'image':
    case 'section_break':
    case 'divider':
    case 'static_text':
    case 'hidden':
      return false;
    default:
      return true;
  }
}

function EmptyStateIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
      <path
        d="M4 4.5h10.5L18 8v9a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 17V4.5Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M7 11h8M7 14.5h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

interface CanvasProps {
  /** Exactly one of formId/templateId is set — see the doc comment on
   * FieldSettingsPanelProps in field-settings-panel.tsx for why. Only used here to
   * resolve an "image" field's uploaded-image URL for the in-canvas thumbnail. */
  formId?: string;
  templateId?: string;
  formName?: string;
  branding?: FormBranding;
  page: FormPage;
  pageIndex: number;
  pageCount: number;
  fields: Record<string, FormField>;
  selectedFieldId: string | null;
  onSelectField: (fieldId: string) => void;
  onEditFieldDetails: (fieldId: string) => void;
  onRemoveField: (fieldId: string) => void;
  onDuplicateField: (fieldId: string) => void;
  /** Explicit reorder alternative to drag-and-drop, from the field card's kebab menu. */
  onMoveField: (fieldId: string, direction: 'up' | 'down') => void;
  onAddField: (type: FieldType, index?: number) => void;
  onAddColumnField: (layoutId: string, slotIndex: number, type: FieldType) => void;
  /** Live field-property updates from in-canvas controls (currently just the divider's
   * drag-to-resize handles) — distinct from onEditFieldDetails, which opens the full
   * settings modal instead of patching inline. */
  onUpdateField: (fieldId: string, patch: FieldPatch) => void;
  canEdit: boolean;
  visibleFieldIds: Set<string>;
  fieldIdsWithRules: Set<string>;
}

export function Canvas({
  formId,
  templateId,
  formName,
  branding,
  page,
  pageIndex,
  pageCount,
  fields,
  selectedFieldId,
  onSelectField,
  onEditFieldDetails,
  onRemoveField,
  onDuplicateField,
  onMoveField,
  onAddField,
  onAddColumnField,
  onUpdateField,
  canEdit,
  visibleFieldIds,
  fieldIdsWithRules,
}: CanvasProps) {
  const { setNodeRef, isOver } = useDroppable({ id: CANVAS_DROPPABLE_ID });
  const bodyFieldIds = page.fields;
  const showFormTitle = branding?.showTitle === true;
  const titleAlign = branding?.titleAlign ?? 'center';

  let nextQuestionNumber = 1;
  const questionNumbers = new Map<string, number>();
  for (const fieldId of bodyFieldIds) {
    const field = fields[fieldId];
    if (isNumberedCanvasField(field)) {
      questionNumbers.set(fieldId, nextQuestionNumber);
      nextQuestionNumber += 1;
    }
  }

  const showHero = (showFormTitle && Boolean(formName)) || pageCount > 1;

  return (
    <div ref={setNodeRef} className={`canvas ${isOver ? 'canvas--drop-target' : ''}`}>
      {showHero ? (
        <div className="canvas-hero" style={{ textAlign: titleAlign }}>
          {showFormTitle && formName ? <h1 className="canvas-form-title">{formName}</h1> : null}
          {pageCount > 1 ? (
            <p className="canvas-page-progress">
              {page.title}
              <span className="canvas-page-title-count">
                {pageIndex + 1} OF {pageCount}
              </span>
            </p>
          ) : null}
        </div>
      ) : null}

      {bodyFieldIds.length === 0 ? (
        <div className="canvas-empty">
          <span className="canvas-empty-icon" aria-hidden="true">
            <EmptyStateIcon />
          </span>
          <p className="canvas-empty-title">Start building this page</p>
          <p className="canvas-empty-hint">
            Drag a field from the panel on the left, or add one of these to get started.
          </p>
          {canEdit ? (
            <div className="canvas-empty-quick-add">
              {QUICK_ADD_TYPES.map((type) => (
                <button
                  key={type}
                  type="button"
                  className="canvas-empty-quick-add-item"
                  onClick={() => onAddField(type)}
                >
                  <span className="canvas-empty-quick-add-icon" aria-hidden="true">
                    <PaletteIcon type={type} />
                  </span>
                  {FIELD_TYPE_LABELS[type]}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : (
        <SortableContext items={bodyFieldIds} strategy={verticalListSortingStrategy}>
          <div className="canvas-field-list">
            {bodyFieldIds.map((fieldId, fieldIndex) => {
              const field = fields[fieldId];
              // page.fields referencing a fieldId with no matching entry in `fields` would
              // violate formSchemaSchema's superRefine invariant — every mutation helper in
              // schema-mutations.ts keeps the two in sync, so this only guards against a bug
              // rather than a real runtime case.
              if (!field) return null;

              return (
                <FieldCard
                  key={field.id}
                  field={field}
                  fields={fields}
                  formId={formId}
                  templateId={templateId}
                  questionNumber={questionNumbers.get(field.id)}
                  selected={field.id === selectedFieldId}
                  selectedFieldId={selectedFieldId}
                  visibleFieldIds={visibleFieldIds}
                  fieldIdsWithRules={fieldIdsWithRules}
                  canEdit={canEdit}
                  hasConditionalRule={fieldIdsWithRules.has(field.id)}
                  visibleInPreview={visibleFieldIds.has(field.id)}
                  onSelect={() => onSelectField(field.id)}
                  onSelectField={onSelectField}
                  onEditDetails={() => onEditFieldDetails(field.id)}
                  onEditFieldDetails={onEditFieldDetails}
                  onRemoveField={onRemoveField}
                  onAddColumnField={onAddColumnField}
                  onUpdateField={onUpdateField}
                  onRemove={() => onRemoveField(field.id)}
                  onDuplicate={() => onDuplicateField(field.id)}
                  onMoveUp={() => onMoveField(field.id, 'up')}
                  onMoveDown={() => onMoveField(field.id, 'down')}
                  canMoveUp={fieldIndex > 0}
                  canMoveDown={fieldIndex < bodyFieldIds.length - 1}
                />
              );
            })}
          </div>
        </SortableContext>
      )}
    </div>
  );
}
