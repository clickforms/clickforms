'use client';

import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { FieldCard } from '@/app/forms/[id]/builder/field-card';
import type { FieldPatch } from '@/app/forms/[id]/builder/schema-mutations';
import type { FieldType, FormField, FormPage } from '@/lib/forms/schema';

export const CANVAS_DROPPABLE_ID = 'canvas-dropzone';

interface CanvasProps {
  formId: string;
  page: FormPage;
  fields: Record<string, FormField>;
  selectedFieldId: string | null;
  onSelectField: (fieldId: string) => void;
  onEditFieldDetails: (fieldId: string) => void;
  onRemoveField: (fieldId: string) => void;
  onDuplicateField: (fieldId: string) => void;
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
  fields,
  selectedFieldId,
  onSelectField,
  onEditFieldDetails,
  onRemoveField,
  onDuplicateField,
  onAddColumnField,
  onUpdateField,
  canEdit,
  visibleFieldIds,
  fieldIdsWithRules,
}: CanvasProps) {
  const { setNodeRef, isOver } = useDroppable({ id: CANVAS_DROPPABLE_ID });

  return (
    <div ref={setNodeRef} className={`canvas ${isOver ? 'canvas--drop-target' : ''}`}>
      <p className="canvas-page-title">{page.title}</p>

      {page.fields.length === 0 ? (
        <div className="canvas-empty">
          <p>No fields on this page yet.</p>
          <p className="canvas-empty-hint">
            Drag a field from the palette, or click one to add it here.
          </p>
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
