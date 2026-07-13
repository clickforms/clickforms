'use client';

import { useDroppable } from '@dnd-kit/core';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { MouseEvent } from 'react';
import { useState } from 'react';
import { COLUMN_CHILD_FIELD_TYPES, FIELD_TYPE_LABELS } from '@/app/forms/[id]/builder/field-meta';
import { DatePickerField } from '@/components/date-picker/date-picker-field';
import { TimePickerField } from '@/components/time-picker/time-picker-field';
import { getFieldImageSrc } from '@/lib/forms/field-image';
import {
  fieldHasCustomAppearance,
  resolveFieldContainerStyle,
  resolveFieldInputStyle,
  resolveImageStyle,
  resolveSectionBreakStyle,
  resolveStaticTextBodyStyle,
  resolveStaticTextHeadingStyle,
} from '@/lib/forms/field-styles';
import { getFieldWidthClass } from '@/lib/forms/field-width';
import { resolveMergeFieldsForPreview } from '@/lib/forms/merge-fields';
import type { FieldType, FormField } from '@/lib/forms/schema';

/** Synthetic dnd-kit droppable id for an empty column slot — parsed back out in
 * builder-client.tsx's handleDragEnd via parseColumnSlotDroppableId(). */
export function columnSlotDroppableId(layoutId: string, slotIndex: number): string {
  return `column-slot:${layoutId}:${slotIndex}`;
}

const COLUMN_SLOT_DROPPABLE_ID_RE = /^column-slot:(.+):(\d+)$/;

/** Parses a droppable id produced by columnSlotDroppableId(), or returns null if `id`
 * isn't one (e.g. a plain field id or the canvas dropzone). */
export function parseColumnSlotDroppableId(
  id: string,
): { layoutId: string; slotIndex: number } | null {
  const match = COLUMN_SLOT_DROPPABLE_ID_RE.exec(id);
  const layoutId = match?.[1];
  const slotIndexRaw = match?.[2];
  if (!layoutId || slotIndexRaw === undefined) return null;
  return { layoutId, slotIndex: Number(slotIndexRaw) };
}

/** An empty column cell — the admin either drags a palette field onto it or clicks
 * "Add field" to pick a type from a small menu. Replaces the old behavior of every
 * slot arriving pre-filled with a placeholder short-text field. */
function EmptyColumnSlot({
  layoutId,
  slotIndex,
  canEdit,
  onAdd,
}: {
  layoutId: string;
  slotIndex: number;
  canEdit: boolean;
  onAdd: (type: FieldType) => void;
}) {
  const [open, setOpen] = useState(false);
  const { setNodeRef, isOver } = useDroppable({
    id: columnSlotDroppableId(layoutId, slotIndex),
    data: { source: 'column-slot', layoutId, slotIndex },
    disabled: !canEdit,
  });

  return (
    <div
      ref={setNodeRef}
      className={[
        'column-slot-empty',
        isOver ? 'column-slot-empty--drop-target' : '',
        open ? 'column-slot-empty--open' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {canEdit ? (
        <button
          type="button"
          className="column-slot-empty-trigger"
          onClick={() => setOpen((prev) => !prev)}
        >
          + Add field
        </button>
      ) : (
        <span className="column-slot-empty-trigger column-slot-empty-trigger--disabled">
          Empty column
        </span>
      )}
      {open && canEdit ? (
        <div className="column-slot-empty-menu">
          {COLUMN_CHILD_FIELD_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              className="column-slot-empty-menu-item"
              onClick={() => {
                setOpen(false);
                onAdd(type);
              }}
            >
              {FIELD_TYPE_LABELS[type]}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function GripIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      {[3, 7, 11].flatMap((cy) =>
        [4, 10].map((cx) => (
          <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="1.3" fill="currentColor" />
        )),
      )}
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <rect x="4.5" y="4.5" width="7" height="7" rx="1.2" stroke="currentColor" strokeWidth="1.3" />
      <path
        d="M3 9.5V3.8A1.8 1.8 0 0 1 4.8 2h5.7"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path
        d="M9.4 2.3l2.3 2.3-6.7 6.7H2.7v-2.3l6.7-6.7z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path
        d="M2.5 4h9M5.5 4V2.8c0-.44.36-.8.8-.8h1.4c.44 0 .8.36.8.8V4M5 6.3v4M9 6.3v4M3.3 4l.5 7.2c.04.5.46.9.97.9h4.46c.51 0 .93-.4.97-.9L10.7 4"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Always mounted when canEdit; CSS reveals it on hover (see .field-card-action-overlay
// in globals.css) rather than on click/selection. Mirrors a common "click and drag to
// move the field or: [Edit] [Duplicate] [Delete]" panel, offering the same three actions
// in place of tiny corner icons whenever the field is moused over.
interface FieldActionOverlayProps {
  light?: boolean;
  /** Nested column cells can't be duplicated in-place (fixed slot count). */
  showDuplicate?: boolean;
  onEditDetails: () => void;
  onDuplicate: () => void;
  onRemove: () => void;
}

function FieldActionOverlay({
  light,
  showDuplicate = true,
  onEditDetails,
  onDuplicate,
  onRemove,
}: FieldActionOverlayProps) {
  return (
    <div
      className={['field-card-action-overlay', light ? 'field-card-action-overlay--light' : '']
        .filter(Boolean)
        .join(' ')}
    >
      <p className="field-card-action-hint">
        {showDuplicate ? 'Click and drag to move the field or:' : 'Edit this column field or:'}
      </p>
      <div className="field-card-action-buttons">
        <button
          type="button"
          className="button button--secondary button--small"
          onMouseDown={stopSelectPropagation}
          onClick={(event) => {
            event.stopPropagation();
            onEditDetails();
          }}
        >
          <EditIcon /> Edit
        </button>
        {showDuplicate ? (
          <button
            type="button"
            className="button button--secondary button--small"
            onMouseDown={stopSelectPropagation}
            onClick={(event) => {
              event.stopPropagation();
              onDuplicate();
            }}
          >
            <CopyIcon /> Duplicate
          </button>
        ) : null}
        <button
          type="button"
          className="button button--danger button--small"
          onMouseDown={stopSelectPropagation}
          onClick={(event) => {
            event.stopPropagation();
            onRemove();
          }}
        >
          <TrashIcon /> {showDuplicate ? 'Delete' : 'Clear column'}
        </button>
      </div>
    </div>
  );
}

function FieldPreview({
  field,
  formId,
  fields,
}: {
  field: FormField;
  formId?: string;
  fields?: Record<string, FormField>;
}) {
  const inputStyle = resolveFieldInputStyle(field);

  switch (field.type) {
    case 'short_text':
      return (
        <input
          className="text-input field-preview-input"
          type="text"
          placeholder="Short answer"
          disabled
          style={inputStyle}
        />
      );
    case 'paragraph':
      return (
        <textarea
          className="text-input field-preview-input"
          rows={3}
          placeholder="Long answer"
          disabled
          style={inputStyle}
        />
      );
    case 'multi_choice':
      return (
        <div className="field-preview-options">
          {field.options.map((option) => (
            <label key={option.id} className="field-preview-option">
              <input type="radio" disabled />
              <span>{option.label || 'Untitled option'}</span>
            </label>
          ))}
        </div>
      );
    case 'checkbox':
      return (
        <div className="field-preview-options">
          {field.options.map((option) => (
            <label key={option.id} className="field-preview-option">
              <input type="checkbox" disabled />
              <span>{option.label || 'Untitled option'}</span>
            </label>
          ))}
        </div>
      );
    case 'dropdown':
      return (
        <select className="text-input field-preview-input" disabled style={inputStyle}>
          <option>Select an option</option>
          {field.options.map((option) => (
            <option key={option.id}>{option.label || 'Untitled option'}</option>
          ))}
        </select>
      );
    case 'date':
      return (
        <DatePickerField
          id={`preview-${field.id}`}
          className="text-input field-preview-input"
          style={inputStyle}
          value=""
          disabled
          onChange={() => {}}
        />
      );
    case 'time':
      return (
        <TimePickerField
          id={`preview-${field.id}`}
          className="text-input field-preview-input"
          style={inputStyle}
          value=""
          disabled
          onChange={() => {}}
        />
      );
    case 'email':
      return (
        <input
          className="text-input field-preview-input"
          type="email"
          placeholder="name@example.com"
          disabled
          style={inputStyle}
        />
      );
    case 'file_upload':
      return (
        <div className="field-preview-dropzone" style={inputStyle}>
          <span>Drop a file here or click to upload</span>
          {field.validation?.acceptedTypes && field.validation.acceptedTypes.length > 0 && (
            <span className="field-preview-hint">
              Accepted: {field.validation.acceptedTypes.join(', ')}
            </span>
          )}
        </div>
      );
    case 'signature':
      return (
        <div className="field-preview-signature" style={inputStyle}>
          <span>Sign here</span>
        </div>
      );
    case 'image': {
      const src =
        field.imageStorageKey && formId ? getFieldImageSrc({ formId, fieldId: field.id }) : null;
      if (src) {
        return (
          <div className="field-preview-image-wrap">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt={field.alt ?? field.label}
              className="field-preview-image"
              style={resolveImageStyle(field)}
            />
          </div>
        );
      }
      return (
        <div className="field-preview-dropzone">
          <span>Upload an image in the settings panel</span>
        </div>
      );
    }
    case 'static_text': {
      const html = resolveMergeFieldsForPreview(field.body, fields ?? {});
      return (
        <div className="field-preview-static-text">
          {field.label ? (
            <p
              className="field-preview-static-text-heading"
              style={resolveStaticTextHeadingStyle(field)}
            >
              {field.label}
            </p>
          ) : null}
          {/* Admin-authored rich text from RichTextEditor — see the matching note in
              field-input.tsx for why dangerouslySetInnerHTML is safe here, and for why
              showBody === false skips this block instead of just rendering it empty. */}
          {field.showBody !== false ? (
            <div
              className="field-preview-static-text-body"
              style={resolveStaticTextBodyStyle(field)}
              // biome-ignore lint/security/noDangerouslySetInnerHtml: admin-authored rich text, see note above
              dangerouslySetInnerHTML={{ __html: html }}
            />
          ) : null}
        </div>
      );
    }
    case 'address':
      return (
        <div className="field-preview-address">
          <input
            className="text-input field-preview-input"
            type="text"
            placeholder="Street address"
            disabled
            style={inputStyle}
          />
          <div className="field-preview-address-row">
            <input
              className="text-input field-preview-input"
              type="text"
              placeholder="Suburb"
              disabled
              style={inputStyle}
            />
            <input
              className="text-input field-preview-input"
              type="text"
              placeholder="State"
              disabled
              style={inputStyle}
            />
            <input
              className="text-input field-preview-input"
              type="text"
              placeholder="Postcode"
              disabled
              style={inputStyle}
            />
          </div>
        </div>
      );
    case 'choice_matrix':
      return (
        <table className="field-preview-matrix">
          <thead>
            <tr>
              <th />
              {field.columns.map((column) => (
                <th key={column.id}>{column.label || 'Untitled column'}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {field.rows.map((row) => (
              <tr key={row.id}>
                <td className="field-preview-matrix-row-label">{row.label || 'Untitled row'}</td>
                {field.columns.map((column) => (
                  <td key={column.id}>
                    <input type="radio" disabled name={`preview-${field.id}-${row.id}`} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      );
    default:
      return null;
  }
}

interface FieldCardProps {
  field: FormField;
  fields?: Record<string, FormField>;
  formId?: string;
  selected: boolean;
  canEdit: boolean;
  hasConditionalRule: boolean;
  visibleInPreview: boolean;
  nested?: boolean;
  selectedFieldId?: string | null;
  visibleFieldIds?: Set<string>;
  fieldIdsWithRules?: Set<string>;
  onSelect: () => void;
  onSelectField?: (fieldId: string) => void;
  /** Opens the field-settings modal for this exact field (bound instance-level handler). */
  onEditDetails: () => void;
  /** Raw setter threaded down for column_layout's nested children, mirroring onSelectField. */
  onEditFieldDetails?: (fieldId: string) => void;
  /** Removes/clears a nested column child by id (threaded from the canvas). */
  onRemoveField?: (fieldId: string) => void;
  /** Fills an empty column slot with a freshly-created field of the chosen type. */
  onAddColumnField?: (layoutId: string, slotIndex: number, type: FieldType) => void;
  onRemove: () => void;
  onDuplicate: () => void;
}

function stopSelectPropagation(event: MouseEvent) {
  event.stopPropagation();
}

function handleFieldSelectMouseDown(event: MouseEvent, onSelect: () => void) {
  const target = event.target as HTMLElement;
  if (
    target.closest(
      '.field-drag-handle, .field-card-toolbar, .field-action-button, .field-card-action-buttons',
    )
  ) {
    return;
  }
  onSelect();
}

/** Drag listeners live on the whole card so "Click and drag to move" matches the overlay
 * copy — the grip is a visual cue only (listeners used to sit solely on that tiny
 * handle, which sits under the hover overlay and was easy to miss). */
function DragHandleCue({ light = false }: { light?: boolean }) {
  return (
    <span
      className={['field-drag-handle', light ? 'field-drag-handle--light' : '']
        .filter(Boolean)
        .join(' ')}
      aria-hidden="true"
    >
      <GripIcon />
    </span>
  );
}

export function FieldCard({
  field,
  fields,
  formId,
  selected,
  canEdit,
  hasConditionalRule,
  visibleInPreview,
  nested = false,
  onSelect,
  onSelectField,
  onEditDetails,
  onEditFieldDetails,
  onRemoveField,
  onAddColumnField,
  onRemove,
  onDuplicate,
  selectedFieldId = null,
  visibleFieldIds,
  fieldIdsWithRules,
}: FieldCardProps) {
  const sortable = useSortable({
    id: field.id,
    disabled: !canEdit || nested,
  });

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = sortable;
  const dragProps = canEdit && !nested ? { ...attributes, ...listeners } : {};

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  if (field.type === 'column_layout') {
    return (
      // biome-ignore lint/a11y/noStaticElementInteractions: canvas field-selection via mousedown, part of the dnd-kit drag/select model — see PointerSensor setup in builder-client.tsx
      <div
        ref={setNodeRef}
        style={style}
        className={[
          'column-layout-wrap',
          'field-width--full',
          canEdit ? 'field-card--draggable' : '',
          selected ? 'column-layout-wrap--selected' : '',
          isDragging ? 'field-card--dragging' : '',
          !visibleInPreview ? 'field-card--hidden-preview' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        onMouseDown={(event) => handleFieldSelectMouseDown(event, onSelect)}
        {...dragProps}
      >
        <div className="column-layout-header">
          {canEdit && <DragHandleCue />}
          {canEdit && (
            <div className="field-card-toolbar">
              <button
                type="button"
                className="field-action-button"
                onMouseDown={stopSelectPropagation}
                onClick={(event) => {
                  event.stopPropagation();
                  onDuplicate();
                }}
                aria-label="Duplicate column section"
                title="Duplicate"
              >
                <CopyIcon />
              </button>
              <button
                type="button"
                className="field-action-button"
                onMouseDown={stopSelectPropagation}
                onClick={(event) => {
                  event.stopPropagation();
                  onRemove();
                }}
                aria-label="Remove column section"
                title="Remove"
              >
                &times;
              </button>
            </div>
          )}
          <div className="column-layout-heading">
            <span className="column-layout-title">{field.label || 'Column section'}</span>
            <div className="field-card-badges">
              {hasConditionalRule && <span className="badge badge--draft">Conditional</span>}
              {!visibleInPreview && <span className="badge badge--neutral">Hidden in preview</span>}
              <span className="badge badge--neutral">{field.columns} columns</span>
            </div>
          </div>
        </div>
        <div className={`column-layout-grid column-layout-grid--${field.columns}`}>
          {field.fieldIds.map((childId, slotIndex) => {
            if (childId === null) {
              return (
                <EmptyColumnSlot
                  // biome-ignore lint/suspicious/noArrayIndexKey: slots are positional — an empty cell has no stable id besides its index.
                  key={`${field.id}-slot-${slotIndex}`}
                  layoutId={field.id}
                  slotIndex={slotIndex}
                  canEdit={canEdit}
                  onAdd={(type) => onAddColumnField?.(field.id, slotIndex, type)}
                />
              );
            }
            const child = fields?.[childId];
            if (!child) return null;
            return (
              <FieldCard
                key={childId}
                field={child}
                fields={fields}
                formId={formId}
                selected={selectedFieldId === childId}
                selectedFieldId={selectedFieldId}
                visibleFieldIds={visibleFieldIds}
                fieldIdsWithRules={fieldIdsWithRules}
                canEdit={canEdit}
                hasConditionalRule={fieldIdsWithRules?.has(childId) ?? false}
                visibleInPreview={visibleFieldIds?.has(childId) ?? true}
                nested
                onSelect={() => onSelectField?.(childId)}
                onSelectField={onSelectField}
                onEditDetails={() => onEditFieldDetails?.(childId)}
                onEditFieldDetails={onEditFieldDetails}
                onRemoveField={onRemoveField}
                onRemove={() => onRemoveField?.(childId)}
                onDuplicate={() => {}}
              />
            );
          })}
        </div>
      </div>
    );
  }

  if (field.type === 'section_break') {
    return (
      // biome-ignore lint/a11y/noStaticElementInteractions: canvas field-selection via mousedown, part of the dnd-kit drag/select model — see PointerSensor setup in builder-client.tsx
      <div
        ref={setNodeRef}
        style={style}
        className={[
          'section-break-bar-wrap',
          'field-width--full',
          canEdit ? 'field-card--draggable' : '',
          selected ? 'section-break-bar-wrap--selected' : '',
          isDragging ? 'field-card--dragging' : '',
          !visibleInPreview ? 'field-card--hidden-preview' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        onMouseDown={(event) => handleFieldSelectMouseDown(event, onSelect)}
        {...dragProps}
      >
        <div
          className={['section-break-bar', selected ? 'section-break-bar--selected' : '']
            .filter(Boolean)
            .join(' ')}
          style={resolveSectionBreakStyle(field)}
        >
          {canEdit && <DragHandleCue light />}
          <span className="section-break-title">{field.label || 'New section'}</span>
          {canEdit && (
            <FieldActionOverlay
              light
              onEditDetails={onEditDetails}
              onDuplicate={onDuplicate}
              onRemove={onRemove}
            />
          )}
        </div>
        {field.helpText ? (
          <p className="section-break-instruction-preview">{field.helpText}</p>
        ) : null}
      </div>
    );
  }

  if (field.type === 'static_text') {
    const containerStyle = resolveFieldContainerStyle(field);
    return (
      // biome-ignore lint/a11y/noStaticElementInteractions: canvas field-selection via mousedown, part of the dnd-kit drag/select model — see PointerSensor setup in builder-client.tsx
      <div
        ref={setNodeRef}
        style={{ ...style, ...containerStyle }}
        className={[
          'field-card',
          'field-card--static-text',
          'field-width--full',
          canEdit ? 'field-card--draggable' : '',
          fieldHasCustomAppearance(field) ? 'field-card--has-color' : '',
          selected ? 'field-card--selected' : '',
          isDragging ? 'field-card--dragging' : '',
          !visibleInPreview ? 'field-card--hidden-preview' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        onMouseDown={(event) => handleFieldSelectMouseDown(event, onSelect)}
        {...dragProps}
      >
        {canEdit && <DragHandleCue />}
        <div className="field-card-header">
          <span className="field-card-label field-card-label--muted">Formatted Text</span>
          <div className="field-card-badges">
            {hasConditionalRule && <span className="badge badge--draft">Conditional</span>}
            {!visibleInPreview && <span className="badge badge--neutral">Hidden in preview</span>}
          </div>
        </div>
        <FieldPreview field={field} formId={formId} fields={fields} />
        {canEdit && (
          <FieldActionOverlay
            onEditDetails={onEditDetails}
            onDuplicate={onDuplicate}
            onRemove={onRemove}
          />
        )}
      </div>
    );
  }

  const isImage = field.type === 'image';
  const fieldStyle = resolveFieldContainerStyle(field);
  const widthClass = isImage ? 'field-width--full' : getFieldWidthClass(field);

  if (nested) {
    return (
      // biome-ignore lint/a11y/noStaticElementInteractions: canvas field-selection via mousedown, part of the dnd-kit drag/select model — see PointerSensor setup in builder-client.tsx
      <div
        style={fieldStyle}
        className={[
          'field-card',
          'field-card--nested',
          isImage ? 'field-card--image' : '',
          fieldHasCustomAppearance(field) ? 'field-card--has-color' : '',
          selected ? 'field-card--selected' : '',
          !visibleInPreview ? 'field-card--hidden-preview' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        onMouseDown={(event) => handleFieldSelectMouseDown(event, onSelect)}
      >
        <div className="field-card-header">
          {!isImage ? (
            <span className="field-card-label">
              {field.label || 'Untitled field'}
              {field.required && <span className="field-card-required">*</span>}
            </span>
          ) : field.label ? (
            <span className="field-card-label">{field.label}</span>
          ) : (
            <span className="field-card-label field-card-label--muted">Image</span>
          )}
          <div className="field-card-badges">
            <span className="badge badge--neutral">{FIELD_TYPE_LABELS[field.type]}</span>
          </div>
        </div>
        {field.helpText && !isImage ? <p className="field-card-help">{field.helpText}</p> : null}
        <FieldPreview field={field} formId={formId} fields={fields} />
        {canEdit && (
          <FieldActionOverlay
            showDuplicate={false}
            onEditDetails={onEditDetails}
            onDuplicate={onDuplicate}
            onRemove={onRemove}
          />
        )}
      </div>
    );
  }

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: canvas field-selection via mousedown, part of the dnd-kit drag/select model — see PointerSensor setup in builder-client.tsx
    <div
      ref={setNodeRef}
      style={{ ...style, ...fieldStyle }}
      className={[
        'field-card',
        widthClass,
        canEdit ? 'field-card--draggable' : '',
        isImage ? 'field-card--image' : '',
        fieldHasCustomAppearance(field) ? 'field-card--has-color' : '',
        selected ? 'field-card--selected' : '',
        isDragging ? 'field-card--dragging' : '',
        !visibleInPreview ? 'field-card--hidden-preview' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      onMouseDown={(event) => handleFieldSelectMouseDown(event, onSelect)}
      {...dragProps}
    >
      {canEdit && <DragHandleCue />}

      <div className="field-card-header">
        {!isImage ? (
          <span className="field-card-label">
            {field.label || 'Untitled field'}
            {field.required && <span className="field-card-required">*</span>}
          </span>
        ) : field.label ? (
          <span className="field-card-label">{field.label}</span>
        ) : (
          <span className="field-card-label field-card-label--muted">Image</span>
        )}
        <div className="field-card-badges">
          {hasConditionalRule && <span className="badge badge--draft">Conditional</span>}
          {!visibleInPreview && <span className="badge badge--neutral">Hidden in preview</span>}
        </div>
      </div>

      {field.helpText && !isImage ? <p className="field-card-help">{field.helpText}</p> : null}

      <FieldPreview field={field} formId={formId} />

      {'options' in field && field.options.length === 0 && (
        <p className="form-error">This field needs at least one option.</p>
      )}

      {field.type === 'choice_matrix' && (field.rows.length === 0 || field.columns.length < 2) && (
        <p className="form-error">This field needs at least one row and two columns.</p>
      )}

      {canEdit && (
        <FieldActionOverlay
          onEditDetails={onEditDetails}
          onDuplicate={onDuplicate}
          onRemove={onRemove}
        />
      )}
    </div>
  );
}
