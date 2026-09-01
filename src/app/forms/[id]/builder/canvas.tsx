'use client';

import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { FieldCard } from '@/app/forms/[id]/builder/field-card';
import { FIELD_TYPE_LABELS } from '@/app/forms/[id]/builder/field-meta';
import type { FieldPatch } from '@/app/forms/[id]/builder/schema-mutations';
import type { FieldType, FormField, FormPage } from '@/lib/forms/schema';

export const CANVAS_DROPPABLE_ID = 'canvas-dropzone';

/** Quick-add pills shown in the empty-page state — a fast path into the most commonly
 * reached-for field types, for anyone who'd rather tap than drag from the palette. */
const QUICK_ADD_TYPES: FieldType[] = ['short_text', 'section_break', 'multi_choice', 'image'];

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
  formId: string;
  page: FormPage;
  pageIndex: number;
  pageCount: number;
  fields: Record<string, FormField>;
  selectedFieldId: string | null;
  onSelectField: (fieldId: string) => void;
  onEditFieldDetails: (fieldId: string) => void;
  onRemoveField: (fieldId: string) => void;
  onDuplicateField: (fieldId: string) => void;
  onAddField: (type: FieldType) => void;
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
  page,
  pageIndex,
  pageCount,
  fields,
  selectedFieldId,
  onSelectField,
  onEditFieldDetails,
  onRemoveField,
  onDuplicateField,
  onAddField,
  onAddColumnField,
  onUpdateField,
  canEdit,
  visibleFieldIds,
  fieldIdsWithRules,
}: CanvasProps) {
  const { setNodeRef, isOver } = useDroppable({ id: CANVAS_DROPPABLE_ID });

  return (
    <div ref={setNodeRef} className={`canvas ${isOver ? 'canvas--drop-target' : ''}`}>
      <p className="canvas-page-title">
        {page.title}
        <span className="canvas-page-title-count">
          {pageIndex + 1} OF {pageCount}
        </span>
      </p>

      {page.fields.length === 0 ? (
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
                  {FIELD_TYPE_LABELS[type]}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : (
        <SortableContext items={page.fields} strategy={verticalListSortingStrategy}>
          <div className="canvas-field-list">
            {page.fields.map((fieldId) => {
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
                />
              );
            })}
          </div>
        </SortableContext>
      )}
    </div>
  );
}
