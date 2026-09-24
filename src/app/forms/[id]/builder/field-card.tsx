'use client';

import { useDroppable } from '@dnd-kit/core';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { CSSProperties, MouseEvent, PointerEvent as ReactPointerEvent } from 'react';
import { useEffect, useRef, useState } from 'react';
import { COLUMN_CHILD_FIELD_TYPES, FIELD_TYPE_LABELS } from '@/app/forms/[id]/builder/field-meta';
import type { FieldPatch } from '@/app/forms/[id]/builder/schema-mutations';
import { DatePickerField } from '@/components/date-picker/date-picker-field';
import { TimePickerField } from '@/components/time-picker/time-picker-field';
import { describeCalculationFormula } from '@/lib/forms/calculation';
import { getFieldImageSrc } from '@/lib/forms/field-image';
import {
  fieldHasCustomAppearance,
  resolveDividerCaptionStyle,
  resolveDividerLineStyle,
  resolveDividerWrapStyle,
  resolveFieldContainerStyle,
  resolveFieldInputStyle,
  resolveImageStyle,
  resolveSectionBreakStyle,
  resolveStaticTextBodyStyle,
  resolveStaticTextHeadingStyle,
} from '@/lib/forms/field-styles';
import { getFieldWidthClass } from '@/lib/forms/field-width';
import { resolveMergeFieldsForPreview } from '@/lib/forms/merge-fields';
import {
  DEFAULT_DIVIDER_THICKNESS_PX,
  DEFAULT_DIVIDER_WIDTH_PX,
  DEFAULT_TABLE_ROWS,
  DIVIDER_THICKNESS_MAX_PX,
  DIVIDER_THICKNESS_MIN_PX,
  DIVIDER_WIDTH_MAX_PX,
  DIVIDER_WIDTH_MIN_PX,
  type FieldType,
  type FormField,
  QUESTION_ROW_ANSWER_TYPE_LABEL,
  TABLE_COLUMN_TYPE_LABEL,
  TABLE_ROWS_MAX,
} from '@/lib/forms/schema';
import { maskPlaceholder } from '@/lib/forms/text-mask';

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
      {[5, 9].flatMap((cy) =>
        [3, 7, 11].map((cx) => (
          <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="1.3" fill="currentColor" />
        )),
      )}
    </svg>
  );
}

function GearIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4Z"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path
        d="M19.4 13.05a7.6 7.6 0 0 0 .06-1.05 7.6 7.6 0 0 0-.06-1.05l2.06-1.61-1.96-3.4-2.48.99a7.9 7.9 0 0 0-1.82-1.05L14.8 2.5h-5.6l-.4 2.38c-.66.27-1.27.62-1.82 1.05l-2.48-.99-1.96 3.4 2.06 1.61A7.6 7.6 0 0 0 4.54 12a7.6 7.6 0 0 0 .06 1.05L2.54 14.66l1.96 3.4 2.48-.99c.55.43 1.16.78 1.82 1.05l.4 2.38h5.6l.4-2.38c.66-.27 1.27-.62 1.82-1.05l2.48.99 1.96-3.4-2.06-1.61Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
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

function ArrowUpIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path
        d="M7 11.2V2.8M3.2 6.6 7 2.8l3.8 3.8"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ArrowDownIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path
        d="M7 2.8v8.4M3.2 7.4 7 11.2l3.8-3.8"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CloudUploadIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M6.2 15h8.1a3.2 3.2 0 0 0 .5-6.36 4.3 4.3 0 0 0-8.4-1.2A3.6 3.6 0 0 0 6.2 15Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M10 12.5V8m0 0-2 2m2-2 2 2"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Always mounted when canEdit; CSS reveals it on hover (see .field-card-toolbar
// in globals.css) rather than on click/selection.

function FieldHoverToolbar({
  showDuplicate = true,
  showMove = true,
  onEditDetails,
  onDuplicate,
  onRemove,
  onMoveUp,
  onMoveDown,
  canMoveUp = false,
  canMoveDown = false,
}: {
  showDuplicate?: boolean;
  /** Hidden for nested column children — "up/down" doesn't map cleanly onto a
   * horizontal layout's side-by-side slots. */
  showMove?: boolean;
  onEditDetails: () => void;
  onDuplicate: () => void;
  onRemove: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
}) {
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!moreOpen) return;

    function handlePointerDown(event: PointerEvent) {
      if (!moreRef.current?.contains(event.target as Node)) {
        setMoreOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setMoreOpen(false);
    }

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [moreOpen]);

  return (
    <div className="field-card-toolbar">
      <button
        type="button"
        className="field-action-button"
        onMouseDown={stopSelectPropagation}
        onClick={(event) => {
          event.stopPropagation();
          onEditDetails();
        }}
        aria-label="Field settings"
        title="Settings"
      >
        <GearIcon />
      </button>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: stops the card's click-to-select mousedown */}
      <div
        className={['field-card-kebab', moreOpen ? 'field-card-kebab--open' : '']
          .filter(Boolean)
          .join(' ')}
        ref={moreRef}
        onMouseDown={stopSelectPropagation}
      >
        <button
          type="button"
          className="field-action-button"
          onClick={(event) => {
            event.stopPropagation();
            setMoreOpen((prev) => !prev);
          }}
          aria-haspopup="menu"
          aria-expanded={moreOpen}
          aria-label="More field actions"
          title="More"
        >
          <KebabIcon />
        </button>
        {moreOpen ? (
          // biome-ignore lint/a11y/noNoninteractiveElementToInteractiveRole: WAI-ARIA APG menu pattern
          <ul className="field-card-kebab-panel" role="menu">
            {showDuplicate ? (
              <li role="none">
                <button
                  type="button"
                  className="actions-menu-item"
                  role="menuitem"
                  onClick={(event) => {
                    event.stopPropagation();
                    setMoreOpen(false);
                    onDuplicate();
                  }}
                >
                  <span className="actions-menu-icon">
                    <CopyIcon />
                  </span>
                  Duplicate
                </button>
              </li>
            ) : null}
            {showMove ? (
              <>
                <li role="none">
                  <button
                    type="button"
                    className="actions-menu-item"
                    role="menuitem"
                    disabled={!canMoveUp}
                    onClick={(event) => {
                      event.stopPropagation();
                      setMoreOpen(false);
                      onMoveUp?.();
                    }}
                  >
                    <span className="actions-menu-icon">
                      <ArrowUpIcon />
                    </span>
                    Move Up
                  </button>
                </li>
                <li role="none">
                  <button
                    type="button"
                    className="actions-menu-item"
                    role="menuitem"
                    disabled={!canMoveDown}
                    onClick={(event) => {
                      event.stopPropagation();
                      setMoreOpen(false);
                      onMoveDown?.();
                    }}
                  >
                    <span className="actions-menu-icon">
                      <ArrowDownIcon />
                    </span>
                    Move Down
                  </button>
                </li>
              </>
            ) : null}
            <li role="none">
              <button
                type="button"
                className="actions-menu-item actions-menu-item--danger"
                role="menuitem"
                onClick={(event) => {
                  event.stopPropagation();
                  setMoreOpen(false);
                  onRemove();
                }}
              >
                <span className="actions-menu-icon">
                  <TrashIcon />
                </span>
                {showDuplicate ? 'Delete' : 'Clear'}
              </button>
            </li>
          </ul>
        ) : null}
      </div>
    </div>
  );
}

function FieldPreview({
  field,
  formId,
  templateId,
  fields,
  canEdit,
  onUpdateField,
}: {
  field: FormField;
  formId?: string;
  templateId?: string;
  fields?: Record<string, FormField>;
  /** Only wired up for field types with an inline-editable canvas preview (currently just
   * 'table' — see the DividerResizeHandles precedent above for the same "edit live from
   * the canvas" pattern). Every other field type ignores these two props entirely. */
  canEdit?: boolean;
  onUpdateField?: (fieldId: string, patch: FieldPatch) => void;
}) {
  const inputStyle = resolveFieldInputStyle(field);

  switch (field.type) {
    case 'short_text':
      return (
        <input
          className="text-input field-preview-input"
          type="text"
          placeholder={field.placeholder || 'Short answer'}
          disabled
          style={inputStyle}
        />
      );
    case 'paragraph':
      return (
        <textarea
          className="text-input field-preview-input"
          rows={field.rows ?? 3}
          placeholder={field.placeholder || 'Long answer'}
          disabled
          style={inputStyle}
        />
      );
    case 'multi_choice':
      return (
        <div className="field-preview-options">
          {field.options.map((option) => (
            <label key={option.id} className="field-preview-option">
              <input type="radio" disabled checked={field.defaultValue === option.id} readOnly />
              <span>{option.label || 'Untitled option'}</span>
            </label>
          ))}
          {field.allowOther ? (
            <label className="field-preview-option field-preview-option--other">
              <input type="radio" disabled />
              <span>Other</span>
            </label>
          ) : null}
          {field.randomizeOrder ? (
            <span className="field-preview-hint">Order shown to respondents is randomized</span>
          ) : null}
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
          {field.allowOther ? (
            <label className="field-preview-option field-preview-option--other">
              <input type="checkbox" disabled />
              <span>Other</span>
            </label>
          ) : null}
          {field.randomizeOrder ? (
            <span className="field-preview-hint">Order shown to respondents is randomized</span>
          ) : null}
        </div>
      );
    case 'dropdown':
      return (
        <select className="text-input field-preview-input" disabled style={inputStyle}>
          <option>{field.placeholder || 'Select an option'}</option>
          {field.options.map((option) => (
            <option key={option.id}>{option.label || 'Untitled option'}</option>
          ))}
          {field.allowOther ? <option>Other</option> : null}
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
    case 'file_upload': {
      const hint = [
        field.validation?.acceptedTypes?.length
          ? `Accepted: ${field.validation.acceptedTypes.join(', ')}`
          : null,
        field.validation?.maxSizeMb ? `Max. file size: ${field.validation.maxSizeMb}MB` : null,
      ]
        .filter((part): part is string => part !== null)
        .join(' · ');
      return (
        // Non-interactive mockup (no real <input>) — matches .form-field-file-dropzone on
        // the live form 1:1 so the canvas is a true preview of what respondents see.
        <div className="form-field-file-dropzone field-preview-dropzone" style={inputStyle}>
          <span className="form-field-file-dropzone-icon" aria-hidden="true">
            <CloudUploadIcon />
          </span>
          <span className="form-field-file-dropzone-label">
            {field.multiple ? 'Tap to upload documents' : 'Tap to upload a document'}
          </span>
          {hint ? <span className="form-field-file-dropzone-hint">{hint}</span> : null}
        </div>
      );
    }
    case 'signature':
      return (
        <div className="field-preview-signature" style={inputStyle}>
          <span>Sign here</span>
        </div>
      );
    case 'image': {
      const src =
        field.imageStorageKey && (formId || templateId)
          ? getFieldImageSrc({ formId, templateId, fieldId: field.id })
          : null;
      const align = field.align ?? 'center';
      if (src) {
        return (
          <div className={`field-preview-image-wrap field-preview-image-wrap--align-${align}`}>
            {/* biome-ignore lint/performance/noImgElement: dynamic/presigned image URLs; next/image is a poor fit here */}
            <img
              src={src}
              alt={field.alt ?? field.label}
              className="field-preview-image"
              style={resolveImageStyle(field)}
            />
            {field.linkUrl ? (
              <span className="field-preview-hint">Links to {field.linkUrl}</span>
            ) : null}
          </div>
        );
      }
      return (
        <div className="field-preview-dropzone">
          <span>Upload an image in the settings panel</span>
        </div>
      );
    }
    case 'draw_on_image': {
      const src =
        field.imageStorageKey && (formId || templateId)
          ? getFieldImageSrc({ formId, templateId, fieldId: field.id })
          : null;
      if (!src) {
        // No wrapping .field-preview-draw-on-image box here — it has its own dashed
        // border, and nesting it around .field-preview-dropzone (which has one too)
        // would double up the border with nothing but a stray "draws here" badge
        // floating over empty space to show for it.
        return (
          <div className="field-preview-dropzone">
            <span>Upload a background image in the settings panel</span>
          </div>
        );
      }
      return (
        <div className="field-preview-draw-on-image">
          {/* biome-ignore lint/performance/noImgElement: dynamic/presigned image URL; next/image is a poor fit here */}
          <img
            src={src}
            alt={field.alt ?? field.label}
            className="field-preview-draw-on-image-bg"
          />
          <span className="field-preview-draw-on-image-badge">Respondent draws here</span>
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
          {field.includeCountry ? (
            <input
              className="text-input field-preview-input"
              type="text"
              placeholder="Country"
              disabled
              style={inputStyle}
            />
          ) : null}
        </div>
      );
    case 'full_name':
      return (
        <div className="field-preview-full-name-row">
          {field.includePrefix ? (
            <input
              className="text-input field-preview-input field-preview-full-name-prefix"
              type="text"
              placeholder="Prefix"
              disabled
              style={inputStyle}
            />
          ) : null}
          <input
            className="text-input field-preview-input"
            type="text"
            placeholder="First name"
            disabled
            style={inputStyle}
          />
          {field.includeMiddleName ? (
            <input
              className="text-input field-preview-input"
              type="text"
              placeholder="Middle name"
              disabled
              style={inputStyle}
            />
          ) : null}
          <input
            className="text-input field-preview-input"
            type="text"
            placeholder="Last name"
            disabled
            style={inputStyle}
          />
        </div>
      );
    case 'masked_text':
      return (
        <input
          className="text-input field-preview-input"
          type="text"
          placeholder={field.placeholder || maskPlaceholder(field.mask)}
          disabled
          style={inputStyle}
        />
      );
    case 'calculation':
      return (
        <div className="field-preview-calculation" style={inputStyle}>
          <span className="field-preview-calculation-formula">
            {field.formula
              ? describeCalculationFormula(field.formula, fields ?? {})
              : 'No formula set'}
          </span>
          <span className="field-preview-calculation-badge">Auto-calculated</span>
        </div>
      );
    case 'yes_no':
      return (
        <div className="field-preview-yes-no">
          <button type="button" className="field-preview-yes-no-option" disabled style={inputStyle}>
            {field.yesLabel || 'Yes'}
          </button>
          <button type="button" className="field-preview-yes-no-option" disabled style={inputStyle}>
            {field.noLabel || 'No'}
          </button>
        </div>
      );
    case 'ranking':
      return (
        <div className="field-preview-ranking">
          {field.options.map((option, index) => (
            <div key={option.id} className="field-preview-ranking-row">
              <span className="field-preview-ranking-index">{index + 1}</span>
              <span className="field-preview-ranking-label">{option.label}</span>
              <span className="field-preview-ranking-handle" aria-hidden="true">
                ⠿
              </span>
            </div>
          ))}
        </div>
      );
    case 'picture_choice':
      return (
        <div className="field-preview-picture-choice">
          {field.options.map((option) => (
            <div key={option.id} className="field-preview-picture-choice-tile">
              {option.imageUrl ? (
                // biome-ignore lint/performance/noImgElement: admin-supplied arbitrary URL, next/image requires a known host
                <img
                  src={option.imageUrl}
                  alt={option.label}
                  className="field-preview-picture-choice-image"
                />
              ) : (
                <div className="field-preview-picture-choice-placeholder" aria-hidden="true">
                  <svg width="20" height="20" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                    <rect
                      x="2"
                      y="3"
                      width="14"
                      height="12"
                      rx="1.4"
                      stroke="currentColor"
                      strokeWidth="1.3"
                    />
                    <circle cx="6" cy="7" r="1.3" stroke="currentColor" strokeWidth="1.2" />
                    <path
                      d="M3.5 13l3.5-4 2.6 2.6 2.4-3 3 4.4"
                      stroke="currentColor"
                      strokeWidth="1.2"
                      fill="none"
                    />
                  </svg>
                </div>
              )}
              <span className="field-preview-picture-choice-label">{option.label}</span>
            </div>
          ))}
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
    case 'table': {
      // Captured as its own const (rather than reading the outer `field` param directly)
      // so the nested functions below keep TypeScript's 'table' narrowing — closures over
      // a switch-narrowed function parameter lose that narrowing in TS, but closures over
      // a const declared right here don't.
      const tableField = field;
      const previewRowCount = tableField.defaultRows ?? DEFAULT_TABLE_ROWS;
      // Inline canvas editing (add/rename/remove columns, adjust the starting row count)
      // only kicks in when the caller wired up onUpdateField — mirrors Jotform's matrix
      // editor, where the grid itself is the primary editing surface and the field's
      // settings panel (gear icon) is reserved for per-column type/options detail. Falls
      // back to the plain disabled preview wherever onUpdateField isn't available (e.g.
      // read-only contexts) or the admin can't edit.
      const canEditInline = canEdit && Boolean(onUpdateField);

      function updateColumnLabel(index: number, label: string) {
        onUpdateField?.(tableField.id, {
          columns: tableField.columns.map((column, i) =>
            i === index ? { ...column, label } : column,
          ),
        });
      }

      function removeColumn(index: number) {
        if (tableField.columns.length <= 1) return;
        onUpdateField?.(tableField.id, {
          columns: tableField.columns.filter((_, i) => i !== index),
        });
      }

      function addColumn() {
        onUpdateField?.(tableField.id, {
          columns: [
            ...tableField.columns,
            {
              id: crypto.randomUUID(),
              label: `Column ${tableField.columns.length + 1}`,
              type: 'short_text',
            },
          ],
        });
      }

      function addRow() {
        onUpdateField?.(tableField.id, {
          defaultRows: Math.min(previewRowCount + 1, TABLE_ROWS_MAX),
        });
      }

      function removeRow() {
        if (previewRowCount <= 1) return;
        onUpdateField?.(tableField.id, { defaultRows: previewRowCount - 1 });
      }

      return (
        <div className="field-preview-table-wrap">
          <table className="field-preview-table">
            <thead>
              <tr>
                {field.columns.map((column, index) => (
                  <th key={column.id}>
                    {canEditInline ? (
                      <span className="field-preview-table-col-header">
                        <input
                          className="field-preview-table-col-input"
                          value={column.label}
                          placeholder="Untitled column"
                          onMouseDown={stopSelectPropagation}
                          onChange={(event) => updateColumnLabel(index, event.target.value)}
                        />
                        <button
                          type="button"
                          className="field-preview-table-col-remove"
                          disabled={field.columns.length <= 1}
                          aria-label="Remove column"
                          onMouseDown={stopSelectPropagation}
                          onClick={() => removeColumn(index)}
                        >
                          &times;
                        </button>
                      </span>
                    ) : (
                      column.label || 'Untitled column'
                    )}
                  </th>
                ))}
                {canEditInline ? (
                  <th className="field-preview-table-add-column-cell">
                    <button
                      type="button"
                      className="field-preview-table-add-column"
                      onMouseDown={stopSelectPropagation}
                      onClick={addColumn}
                    >
                      + add column
                    </button>
                  </th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: previewRowCount }, (_, rowIndex) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: placeholder rows have no real id yet — the respondent, not the admin, creates actual rows here
                <tr key={rowIndex}>
                  {field.columns.map((column) => (
                    <td key={column.id}>
                      <input
                        className="text-input field-preview-input"
                        type="text"
                        disabled
                        placeholder={TABLE_COLUMN_TYPE_LABEL[column.type]}
                      />
                    </td>
                  ))}
                  {canEditInline ? <td className="field-preview-table-add-column-cell" /> : null}
                </tr>
              ))}
            </tbody>
          </table>
          {canEditInline ? (
            <div className="field-preview-table-row-controls">
              <button
                type="button"
                className="field-preview-table-add-row"
                onMouseDown={stopSelectPropagation}
                onClick={addRow}
              >
                + add row
              </button>
              {previewRowCount > 1 ? (
                <button
                  type="button"
                  className="field-preview-table-remove-row"
                  onMouseDown={stopSelectPropagation}
                  onClick={removeRow}
                >
                  &minus; remove row
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      );
    }
    case 'question_table': {
      // Same TS-narrowing capture as the 'table' case above — nested functions closing
      // over `field` directly would lose the 'question_table' narrowing.
      const questionTableField = field;
      // Inline editing here is scoped to renaming/adding/removing questions (the rows) —
      // per-row answer type and required-ness, plus the header/color settings, still live
      // in the settings panel, mirroring how 'table' reserves per-column type/options for
      // its settings panel while the canvas handles column labels and row count.
      const canEditInline = canEdit && Boolean(onUpdateField);
      const fieldColumnLabel = questionTableField.fieldColumnLabel || 'Field';
      const valueColumnLabel = questionTableField.valueColumnLabel || 'Details';
      const headerStyle: CSSProperties = {
        backgroundColor: questionTableField.headerColor,
        color: questionTableField.headerTextColor,
      };
      const valueStyle: CSSProperties = {
        backgroundColor: questionTableField.valueColor,
      };

      function updateRowLabel(index: number, label: string) {
        onUpdateField?.(questionTableField.id, {
          rows: questionTableField.rows.map((row, i) => (i === index ? { ...row, label } : row)),
        });
      }

      function removeRow(index: number) {
        if (questionTableField.rows.length <= 1) return;
        onUpdateField?.(questionTableField.id, {
          rows: questionTableField.rows.filter((_, i) => i !== index),
        });
      }

      function addRow() {
        onUpdateField?.(questionTableField.id, {
          rows: [
            ...questionTableField.rows,
            {
              id: crypto.randomUUID(),
              label: `Question ${questionTableField.rows.length + 1}`,
              type: 'short_text',
              required: true,
            },
          ],
        });
      }

      return (
        <div className="field-preview-question-table-wrap">
          <table className="field-preview-question-table">
            <thead>
              <tr>
                <th style={headerStyle}>{fieldColumnLabel}</th>
                <th style={headerStyle}>{valueColumnLabel}</th>
              </tr>
            </thead>
            <tbody>
              {questionTableField.rows.map((row, index) => (
                <tr key={row.id}>
                  <td className="field-preview-question-table-label-cell">
                    {canEditInline ? (
                      <span className="field-preview-table-col-header">
                        <input
                          className="field-preview-table-col-input"
                          value={row.label}
                          placeholder="Question"
                          onMouseDown={stopSelectPropagation}
                          onChange={(event) => updateRowLabel(index, event.target.value)}
                        />
                        <button
                          type="button"
                          className="field-preview-table-col-remove"
                          disabled={questionTableField.rows.length <= 1}
                          aria-label="Remove question"
                          onMouseDown={stopSelectPropagation}
                          onClick={() => removeRow(index)}
                        >
                          &times;
                        </button>
                      </span>
                    ) : (
                      <>
                        {row.label || 'Untitled question'}
                        {row.required ? <span className="field-card-required"> *</span> : null}
                      </>
                    )}
                  </td>
                  <td style={valueStyle}>
                    {row.type === 'dropdown' ? (
                      <select className="text-input field-preview-input" disabled>
                        <option>Select an option</option>
                        {(row.options ?? []).map((option) => (
                          <option key={option.id}>{option.label || 'Untitled option'}</option>
                        ))}
                      </select>
                    ) : row.type === 'date' ? (
                      <DatePickerField
                        id={`preview-${field.id}-${row.id}`}
                        className="text-input field-preview-input"
                        value=""
                        disabled
                        onChange={() => {}}
                      />
                    ) : (
                      <input
                        className="text-input field-preview-input"
                        type={row.type === 'number' ? 'number' : 'text'}
                        disabled
                        placeholder={QUESTION_ROW_ANSWER_TYPE_LABEL[row.type]}
                      />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {canEditInline ? (
            <div className="field-preview-table-row-controls">
              <button
                type="button"
                className="field-preview-table-add-row"
                onMouseDown={stopSelectPropagation}
                onClick={addRow}
              >
                + add question
              </button>
            </div>
          ) : null}
        </div>
      );
    }
    case 'number':
      return (
        <div className="field-preview-number">
          {field.prefix ? <span className="field-preview-affix">{field.prefix}</span> : null}
          <input
            className="text-input field-preview-input"
            type="number"
            placeholder={field.placeholder || '0'}
            disabled
            style={inputStyle}
          />
          {field.suffix ? <span className="field-preview-affix">{field.suffix}</span> : null}
        </div>
      );
    case 'phone':
      return (
        <div className="field-preview-number">
          {field.defaultCountryCode ? (
            <span className="field-preview-affix">{field.defaultCountryCode}</span>
          ) : null}
          <input
            className="text-input field-preview-input"
            type="tel"
            placeholder={field.placeholder || '+61 4XX XXX XXX'}
            disabled
            style={inputStyle}
          />
        </div>
      );
    case 'website':
      return (
        <input
          className="text-input field-preview-input"
          type="url"
          placeholder={field.placeholder || 'https://example.com'}
          disabled
          style={inputStyle}
        />
      );
    case 'rating': {
      const max = field.maxRating ?? 5;
      const color = field.color;
      return (
        <div
          className="field-preview-rating"
          style={color ? ({ color } as CSSProperties) : undefined}
        >
          {Array.from({ length: max }, (_, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: a fixed-length star row has no other stable identity
            <RatingPreviewIcon key={index} icon={field.icon ?? 'star'} />
          ))}
        </div>
      );
    }
    case 'opinion_scale': {
      const min = field.scaleMin ?? 0;
      const max = field.scaleMax ?? 10;
      const steps = Array.from({ length: max - min + 1 }, (_, index) => min + index);
      return (
        <div className="field-preview-opinion-scale">
          <div className="field-preview-opinion-scale-row">
            {steps.map((step) => (
              <span key={step} className="field-preview-opinion-scale-step">
                {step}
              </span>
            ))}
          </div>
          {field.minLabel || field.maxLabel || field.midLabel ? (
            <div className="field-preview-opinion-scale-labels">
              <span>{field.minLabel}</span>
              {field.midLabel ? <span>{field.midLabel}</span> : null}
              <span>{field.maxLabel}</span>
            </div>
          ) : null}
        </div>
      );
    }
    case 'legal':
      return (
        <label className="field-preview-option field-preview-legal">
          <input type="checkbox" disabled />
          <span>
            {field.consentText}
            {field.linkLabel ? (
              <>
                {' '}
                <span className="field-preview-legal-link">{field.linkLabel}</span>
              </>
            ) : null}
          </span>
        </label>
      );
    case 'hidden':
      return (
        <div className="field-preview-hidden">
          <EyeOffIcon />
          <span>
            Hidden from respondents
            {field.sourceParam ? (
              <>
                {' '}
                — filled from <code>?{field.sourceParam}=</code>
              </>
            ) : field.defaultValue ? (
              <> — always "{field.defaultValue}"</>
            ) : null}
          </span>
        </div>
      );
    default:
      return null;
  }
}

// Mirrors RATING_ICON_PATHS in field-input.tsx (same viewBox/paths) so the builder
// canvas preview matches what respondents actually see on the published form.
const RATING_PREVIEW_ICON_PATHS: Record<string, string> = {
  star: 'M9 2.7l1.8 3.65 4 .58-2.9 2.83.68 4-3.58-1.88-3.58 1.88.68-4-2.9-2.83 4-.58L9 2.7Z',
  heart:
    'M9 15.5S2.5 11.4 2.5 6.9C2.5 4.5 4.4 3 6.4 3 7.6 3 8.6 3.6 9 4.5 9.4 3.6 10.4 3 11.6 3c2 0 3.9 1.5 3.9 3.9 0 4.5-6.5 8.6-6.5 8.6Z',
  thumb:
    'M2.8 8.2h2.9v7.1H2.8a.7.7 0 0 1-.7-.7V8.9a.7.7 0 0 1 .7-.7Zm4.3.4 2.6-5.4a1.3 1.3 0 0 1 2.4.9l-.8 3.2h3.4a1.4 1.4 0 0 1 1.35 1.85l-1.5 4.9a1.4 1.4 0 0 1-1.34 1H7.1',
};

function RatingPreviewIcon({ icon }: { icon: string }) {
  const path = RATING_PREVIEW_ICON_PATHS[icon] ?? RATING_PREVIEW_ICON_PATHS.star;
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path
        d={path}
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path
        d="M2.5 9S5 4.5 9 4.5 15.5 9 15.5 9 13 13.5 9 13.5 2.5 9 2.5 9Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <circle cx="9" cy="9" r="2" stroke="currentColor" strokeWidth="1.3" />
      <line
        x1="3"
        y1="15"
        x2="15"
        y2="3"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

interface FieldCardProps {
  field: FormField;
  fields?: Record<string, FormField>;
  formId?: string;
  templateId?: string;
  /** 1-based question number shown as "1. Label" on the canvas. Omitted for layout
   * chrome (images, headers, dividers) and nested column children. */
  questionNumber?: number;
  selected: boolean;
  canEdit: boolean;
  hasConditionalRule: boolean;
  visibleInPreview: boolean;
  nested?: boolean;
  /** Presentational clone for DragOverlay — skip sortable listeners so the original
   * canvas card can keep its id. */
  overlay?: boolean;
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
  /** Live field-property patch from in-canvas controls — currently only used by the
   * divider's drag-to-resize handles. Optional because nested column children never need
   * it (divider fields can't be placed in a column slot). */
  onUpdateField?: (fieldId: string, patch: FieldPatch) => void;
  onRemove: () => void;
  onDuplicate: () => void;
  /** Explicit reorder alternative to drag-and-drop, from the kebab menu. Omitted (along
   * with canMoveUp/canMoveDown) for nested column children — see showMove on
   * FieldHoverToolbar. */
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
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

function clampPx(value: number, min: number, max: number): number {
  return Math.round(Math.min(max, Math.max(min, value)));
}

/** Drag-to-resize handles for the divider field's line width (right edge) and thickness
 * (bottom edge) — the only field type in the builder with continuous, free-form resizing
 * rather than a preset picker, so the interaction lives locally here rather than as a
 * shared abstraction. Values commit live via onUpdateField on every pointermove, same as
 * every other in-place field edit in the builder (no separate draft/commit step). */
function DividerResizeHandles({
  field,
  onUpdateField,
}: {
  field: Extract<FormField, { type: 'divider' }>;
  onUpdateField: (fieldId: string, patch: FieldPatch) => void;
}) {
  function startResize(axis: 'width' | 'thickness', event: ReactPointerEvent) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const startX = event.clientX;
    const startY = event.clientY;
    const startWidth = field.dividerWidthPx ?? DEFAULT_DIVIDER_WIDTH_PX;
    const startThickness = field.thicknessPx ?? DEFAULT_DIVIDER_THICKNESS_PX;

    function handleMove(moveEvent: PointerEvent) {
      if (axis === 'width') {
        // The line is centered in its box, so dragging the right-edge handle out by
        // `deltaPx` widens the box by 2x that (both sides grow to stay centered).
        const deltaPx = (moveEvent.clientX - startX) * 2;
        onUpdateField(field.id, {
          dividerWidthPx: clampPx(startWidth + deltaPx, DIVIDER_WIDTH_MIN_PX, DIVIDER_WIDTH_MAX_PX),
        });
      } else {
        const deltaPx = moveEvent.clientY - startY;
        onUpdateField(field.id, {
          thicknessPx: clampPx(
            startThickness + deltaPx,
            DIVIDER_THICKNESS_MIN_PX,
            DIVIDER_THICKNESS_MAX_PX,
          ),
        });
      }
    }

    function handleUp() {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    }

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
  }

  return (
    <>
      <button
        type="button"
        className="field-resize-handle field-resize-handle--width"
        aria-label="Drag to resize divider width"
        title="Drag to resize width"
        onMouseDown={stopSelectPropagation}
        onPointerDown={(event) => startResize('width', event)}
      />
      <button
        type="button"
        className="field-resize-handle field-resize-handle--thickness"
        aria-label="Drag to resize divider thickness"
        title="Drag to resize thickness"
        onMouseDown={stopSelectPropagation}
        onPointerDown={(event) => startResize('thickness', event)}
      />
    </>
  );
}

function KebabIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="6" r="1.7" fill="currentColor" />
      <circle cx="12" cy="12" r="1.7" fill="currentColor" />
      <circle cx="12" cy="18" r="1.7" fill="currentColor" />
    </svg>
  );
}

export function FieldCard({
  field,
  fields,
  formId,
  templateId,
  questionNumber,
  selected,
  canEdit,
  hasConditionalRule,
  visibleInPreview,
  nested = false,
  overlay = false,
  onSelect,
  onSelectField,
  onEditDetails,
  onEditFieldDetails,
  onRemoveField,
  onAddColumnField,
  onUpdateField,
  onRemove,
  onDuplicate,
  onMoveUp,
  onMoveDown,
  canMoveUp = false,
  canMoveDown = false,
  selectedFieldId = null,
  visibleFieldIds,
  fieldIdsWithRules,
}: FieldCardProps) {
  const sortable = useSortable({
    id: overlay ? `__overlay-${field.id}` : field.id,
    disabled: overlay || !canEdit || nested,
  });

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = sortable;
  const dragProps = canEdit && !nested && !overlay ? { ...attributes, ...listeners } : {};

  const style = overlay
    ? undefined
    : {
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
            <FieldHoverToolbar
              onEditDetails={onEditDetails}
              onDuplicate={onDuplicate}
              onRemove={onRemove}
              onMoveUp={onMoveUp}
              onMoveDown={onMoveDown}
              canMoveUp={canMoveUp}
              canMoveDown={canMoveDown}
            />
          )}
          <div className="column-layout-heading">
            <span className="column-layout-title">
              {questionNumber ? `${questionNumber}. ` : ''}
              {field.label || 'Column section'}
              {field.required && <span className="field-card-required">*</span>}
            </span>
            <div className="field-card-badges">
              {hasConditionalRule && <span className="badge badge--draft">Conditional</span>}
              {!visibleInPreview && <span className="badge badge--neutral">Hidden in preview</span>}
            </div>
          </div>
          {field.helpText ? <p className="field-card-help">{field.helpText}</p> : null}
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
                templateId={templateId}
                selected={selectedFieldId === childId}
                selectedFieldId={selectedFieldId}
                visibleFieldIds={visibleFieldIds}
                fieldIdsWithRules={fieldIdsWithRules}
                canEdit={canEdit}
                hasConditionalRule={fieldIdsWithRules?.has(childId) ?? false}
                visibleInPreview={visibleFieldIds?.has(childId) ?? true}
                nested
                overlay={overlay}
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
        <div className="section-break-bar" style={resolveSectionBreakStyle(field)}>
          <span className="section-break-title">{field.label || 'Header'}</span>
        </div>
        {canEdit && <DragHandleCue />}
        {canEdit && (
          <FieldHoverToolbar
            onEditDetails={onEditDetails}
            onDuplicate={onDuplicate}
            onRemove={onRemove}
            onMoveUp={onMoveUp}
            onMoveDown={onMoveDown}
            canMoveUp={canMoveUp}
            canMoveDown={canMoveDown}
          />
        )}
        {field.helpText ? (
          <p className="section-break-instruction-preview">{field.helpText}</p>
        ) : null}
      </div>
    );
  }

  if (field.type === 'divider') {
    return (
      // biome-ignore lint/a11y/noStaticElementInteractions: canvas field-selection via mousedown, part of the dnd-kit drag/select model — see PointerSensor setup in builder-client.tsx
      <div
        ref={setNodeRef}
        style={style}
        className={[
          'divider-field-wrap',
          'field-width--full',
          canEdit ? 'field-card--draggable' : '',
          selected ? 'divider-field-wrap--selected' : '',
          isDragging ? 'field-card--dragging' : '',
          !visibleInPreview ? 'field-card--hidden-preview' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        onMouseDown={(event) => handleFieldSelectMouseDown(event, onSelect)}
        {...dragProps}
      >
        {canEdit && <DragHandleCue />}
        {canEdit && (
          <FieldHoverToolbar
            onEditDetails={onEditDetails}
            onDuplicate={onDuplicate}
            onRemove={onRemove}
            onMoveUp={onMoveUp}
            onMoveDown={onMoveDown}
            canMoveUp={canMoveUp}
            canMoveDown={canMoveDown}
          />
        )}
        <div className="divider-resize-box" style={resolveDividerWrapStyle(field)}>
          {field.label && (field.captionPosition ?? 'above') === 'above' ? (
            <span className="divider-caption" style={resolveDividerCaptionStyle(field)}>
              {field.label}
            </span>
          ) : null}
          <div className="divider-line" style={resolveDividerLineStyle(field)} />
          {field.label && field.captionPosition === 'below' ? (
            <span className="divider-caption" style={resolveDividerCaptionStyle(field)}>
              {field.label}
            </span>
          ) : null}
          {canEdit && onUpdateField && (
            <DividerResizeHandles field={field} onUpdateField={onUpdateField} />
          )}
        </div>
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
          // Only span the full canvas width at the top level — inside a column_layout
          // slot (nested) this must NOT be added, since .field-card.field-width--full
          // is an unscoped `grid-column: 1 / -1` rule that would also fire inside
          // .column-layout-grid, spanning both/all of that layout's columns and pushing
          // the sibling slot onto the next row (see field-card--nested below, which
          // deliberately skips any width class for the same reason).
          !nested ? 'field-width--full' : '',
          nested ? 'field-card--nested' : '',
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
        {canEdit && (
          <FieldHoverToolbar
            onEditDetails={onEditDetails}
            onDuplicate={onDuplicate}
            onRemove={onRemove}
            onMoveUp={onMoveUp}
            onMoveDown={onMoveDown}
            canMoveUp={canMoveUp}
            canMoveDown={canMoveDown}
          />
        )}
        <div className="field-card-header">
          <span className="field-card-label field-card-label--muted">Formatted Text</span>
          <div className="field-card-badges">
            {hasConditionalRule && <span className="badge badge--draft">Conditional</span>}
            {!visibleInPreview && <span className="badge badge--neutral">Hidden in preview</span>}
          </div>
        </div>
        <FieldPreview
          field={field}
          formId={formId}
          templateId={templateId}
          fields={fields}
          canEdit={canEdit}
          onUpdateField={onUpdateField}
        />
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
        {canEdit && (
          <FieldHoverToolbar
            showDuplicate={false}
            showMove={false}
            onEditDetails={onEditDetails}
            onDuplicate={onDuplicate}
            onRemove={onRemove}
          />
        )}
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
        </div>
        {field.helpText && !isImage ? <p className="field-card-help">{field.helpText}</p> : null}
        <FieldPreview
          field={field}
          formId={formId}
          templateId={templateId}
          fields={fields}
          canEdit={canEdit}
          onUpdateField={onUpdateField}
        />
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
      {canEdit && (
        <FieldHoverToolbar
          onEditDetails={onEditDetails}
          onDuplicate={onDuplicate}
          onRemove={onRemove}
          onMoveUp={onMoveUp}
          onMoveDown={onMoveDown}
          canMoveUp={canMoveUp}
          canMoveDown={canMoveDown}
        />
      )}

      <div className="field-card-header">
        {!isImage ? (
          <span className="field-card-label">
            {questionNumber ? `${questionNumber}. ` : ''}
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

      <FieldPreview
        field={field}
        formId={formId}
        templateId={templateId}
        canEdit={canEdit}
        onUpdateField={onUpdateField}
      />

      {'options' in field && field.options.length === 0 && (
        <p className="form-error">This field needs at least one option.</p>
      )}

      {field.type === 'choice_matrix' && (field.rows.length === 0 || field.columns.length < 2) && (
        <p className="form-error">This field needs at least one row and two columns.</p>
      )}

      {field.type === 'table' && field.columns.length === 0 && (
        <p className="form-error">This field needs at least one column.</p>
      )}

      {field.type === 'question_table' && field.rows.length === 0 && (
        <p className="form-error">This field needs at least one question.</p>
      )}
    </div>
  );
}

/** Full-field clone shown under the pointer while rearranging — palette drags still use
 * the small chip; canvas field drags should move this whole card, matching the
 * reference builder. */
export function FieldDragOverlay({
  field,
  fields,
  formId,
  templateId,
  questionNumber,
}: {
  field: FormField;
  fields?: Record<string, FormField>;
  formId?: string;
  templateId?: string;
  questionNumber?: number;
}) {
  return (
    <div className="field-drag-overlay">
      <FieldCard
        field={field}
        fields={fields}
        formId={formId}
        templateId={templateId}
        questionNumber={questionNumber}
        selected
        overlay
        canEdit
        hasConditionalRule={false}
        visibleInPreview
        onSelect={() => {}}
        onEditDetails={() => {}}
        onRemove={() => {}}
        onDuplicate={() => {}}
      />
    </div>
  );
}
