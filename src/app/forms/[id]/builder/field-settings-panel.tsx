'use client';

import type { ReactNode } from 'react';
import { ConditionalLogicEditor } from '@/app/forms/[id]/builder/conditional-logic-editor';
import { FieldColorPicker } from '@/app/forms/[id]/builder/field-color-picker';
import { FieldColorSettings } from '@/app/forms/[id]/builder/field-color-settings';
import { FieldImageUpload } from '@/app/forms/[id]/builder/field-image-upload';
import {
  COLUMN_CHILD_FIELD_TYPES,
  COLUMN_LAYOUT_LABELS,
  FIELD_TYPE_LABELS,
} from '@/app/forms/[id]/builder/field-meta';
import { OptionsEditor } from '@/app/forms/[id]/builder/options-editor';
import { RichTextEditor } from '@/app/forms/[id]/builder/rich-text-editor';
import { type FieldPatch, findParentColumnLayout } from '@/app/forms/[id]/builder/schema-mutations';
import { FIELD_WIDTH_LABEL, FIELD_WIDTHS } from '@/lib/forms/field-width';
import {
  COLUMN_COUNTS,
  type ColumnCount,
  type ConditionalRule,
  DATE_DISPLAY_FORMAT_LABEL,
  DATE_DISPLAY_FORMATS,
  DEFAULT_FIELD_TEXT_COLOR,
  type FieldType,
  FONT_FAMILY_LABEL,
  FONT_FAMILY_OPTIONS,
  FONT_WEIGHT_LABEL,
  FONT_WEIGHT_OPTIONS,
  type FontFamily,
  type FontWeightOption,
  type FormField,
  type FormSchema,
  IMAGE_ALIGN_LABEL,
  IMAGE_ALIGN_OPTIONS,
  IMAGE_SIZE_LABEL,
  IMAGE_SIZE_OPTIONS,
  IMAGE_SPACING_LABEL,
  IMAGE_SPACING_OPTIONS,
  type ImageAlign,
  type ImageSize,
  type ImageSpacing,
  isLayoutOnlyField,
  OPINION_SCALE_MAX_BOUND,
  OPINION_SCALE_MIN_BOUND,
  RATING_ICON_LABEL,
  RATING_ICON_OPTIONS,
  RATING_MAX_MAX,
  RATING_MAX_MIN,
  type RatingIcon,
  TEXT_ALIGN_LABEL,
  TEXT_ALIGN_OPTIONS,
  TEXT_FONT_SIZE_MAX_PX,
  TEXT_FONT_SIZE_MIN_PX,
  type TextAlign,
} from '@/lib/forms/schema';

// ---------------------------------------------------------------------------
// This panel is organized into named, collapsible groups — Content, Validation &
// behavior, Layout, Appearance, Logic — rather than one flat stack of controls. Each
// field type only renders the groups that actually apply to it (a section break has no
// Validation group; an image field has no Logic-eligible answer... it still gets Logic
// since conditional rules can target any field, but never a Validation group). See
// SettingsGroup below for the shared collapsible-section chrome every group uses.
// ---------------------------------------------------------------------------

interface TypeSpecificSettingsProps {
  formId: string;
  field: FormField;
  canEdit: boolean;
  fields: Record<string, FormField>;
  onUpdateField: (fieldId: string, patch: FieldPatch) => void;
  onSetColumnLayoutColumns: (layoutId: string, columns: ColumnCount) => void;
}

// Chevron used on every collapsible group's <summary> — CSS rotates it via the
// details[open] selector so it points down when expanded, right when collapsed.
function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M4 2.5l4 3.5-4 3.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Shared collapsible section chrome for every group in this panel — a consistent
 * header (icon + title + optional trailing hint) with a chevron that rotates on open,
 * and a padded content area below. `defaultOpen` controls each group's *initial* state
 * independently (e.g. Content starts open, Appearance starts closed) via the native
 * <details open> attribute — React doesn't control it after that, so a group a person
 * opens/closes stays that way while they keep editing the same field. */
function SettingsGroup({
  title,
  icon,
  hint,
  defaultOpen = true,
  children,
}: {
  title: string;
  icon: ReactNode;
  hint?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  return (
    <details className="settings-group" open={defaultOpen}>
      <summary className="settings-group-summary">
        <span className="settings-group-summary-left">
          <span className="settings-group-icon">{icon}</span>
          <span className="settings-group-title">{title}</span>
        </span>
        <span className="settings-group-summary-right">
          {hint ? <span className="settings-group-hint">{hint}</span> : null}
          <ChevronIcon className="settings-group-chevron" />
        </span>
      </summary>
      <div className="settings-group-content">{children}</div>
    </details>
  );
}

function ContentIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path
        d="M2 3.5h10M2 7h10M2 10.5h6"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ValidationIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path
        d="M7 1.5l4.8 2v3.3c0 3-2 5.1-4.8 5.7-2.8-.6-4.8-2.7-4.8-5.7V3.5L7 1.5Z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <path
        d="M4.9 7l1.4 1.4L9.3 5.3"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function LayoutIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <rect
        x="1.5"
        y="2"
        width="4.2"
        height="10"
        rx="0.8"
        stroke="currentColor"
        strokeWidth="1.3"
      />
      <rect
        x="6.3"
        y="2"
        width="6.2"
        height="4.5"
        rx="0.8"
        stroke="currentColor"
        strokeWidth="1.3"
      />
      <rect
        x="6.3"
        y="7.5"
        width="6.2"
        height="4.5"
        rx="0.8"
        stroke="currentColor"
        strokeWidth="1.3"
      />
    </svg>
  );
}

function AppearanceIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.3" />
      <path
        d="M7 1.5a5.5 5.5 0 0 1 0 11c-1 0-1.5-.6-1.5-1.3 0-.4.2-.6.4-.9.2-.3.4-.5.4-.9 0-.6-.5-1-1.1-1H4a2.5 2.5 0 0 1-2.5-2.5"
        fill="currentColor"
        fillOpacity="0.15"
      />
      <circle cx="4.6" cy="6" r="0.8" fill="currentColor" />
      <circle cx="6.5" cy="4" r="0.8" fill="currentColor" />
      <circle cx="9" cy="5" r="0.8" fill="currentColor" />
      <circle cx="9.3" cy="8" r="0.8" fill="currentColor" />
    </svg>
  );
}

function LogicIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <circle cx="3" cy="3.5" r="1.6" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="3" cy="10.5" r="1.6" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="11" cy="7" r="1.6" stroke="currentColor" strokeWidth="1.3" />
      <path
        d="M4.5 4.2L9.6 6.3M4.5 9.8L9.6 7.7"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  );
}

function toOptionalNumber(raw: string): number | undefined {
  return raw === '' ? undefined : Number(raw);
}

/** Bold toggle + font-family select + size select + color picker + alignment radio group —
 * shared by static_text's independent "Heading style" and "Body style" sections below, so
 * the two stay visually and behaviorally identical aside from which field properties they
 * write to. */
function TextStyleControls({
  radioGroupName,
  fontWeight,
  onFontWeightChange,
  fontFamily,
  onFontFamilyChange,
  fontSize,
  onFontSizeChange,
  color,
  onColorChange,
  align,
  onAlignChange,
  canEdit,
}: {
  radioGroupName: string;
  fontWeight: FontWeightOption;
  onFontWeightChange: (value: FontWeightOption) => void;
  fontFamily: FontFamily;
  onFontFamilyChange: (value: FontFamily) => void;
  fontSize: number | undefined;
  onFontSizeChange: (value: number | undefined) => void;
  color: string | undefined;
  onColorChange: (value: string | undefined) => void;
  align: TextAlign;
  onAlignChange: (value: TextAlign) => void;
  canEdit: boolean;
}) {
  return (
    <>
      <label className="settings-field">
        <span className="settings-label">Font weight</span>
        <select
          className="text-input"
          disabled={!canEdit}
          value={fontWeight}
          onChange={(event) => onFontWeightChange(event.target.value as FontWeightOption)}
        >
          {FONT_WEIGHT_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {FONT_WEIGHT_LABEL[option]}
            </option>
          ))}
        </select>
      </label>
      <label className="settings-field">
        <span className="settings-label">Font</span>
        <select
          className="text-input"
          disabled={!canEdit}
          value={fontFamily}
          onChange={(event) => onFontFamilyChange(event.target.value as FontFamily)}
        >
          {FONT_FAMILY_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {FONT_FAMILY_LABEL[option]}
            </option>
          ))}
        </select>
      </label>
      <label className="settings-field">
        <span className="settings-label">Size (px)</span>
        <input
          type="number"
          className="text-input"
          disabled={!canEdit}
          min={TEXT_FONT_SIZE_MIN_PX}
          max={TEXT_FONT_SIZE_MAX_PX}
          value={fontSize ?? ''}
          placeholder="Default"
          onChange={(event) => {
            const raw = event.target.value;
            onFontSizeChange(raw === '' ? undefined : Number(raw));
          }}
        />
      </label>
      <FieldColorPicker
        label="Color"
        value={color}
        defaultColor={DEFAULT_FIELD_TEXT_COLOR}
        canEdit={canEdit}
        onChange={onColorChange}
      />
      <div className="settings-width-options">
        {TEXT_ALIGN_OPTIONS.map((option) => (
          <label key={option} className="settings-width-option">
            <input
              type="radio"
              name={radioGroupName}
              checked={align === option}
              disabled={!canEdit}
              onChange={() => onAlignChange(option)}
            />
            {TEXT_ALIGN_LABEL[option]}
          </label>
        ))}
      </div>
    </>
  );
}

/** Everything that belongs in the Content group beyond the shared Label/Section-title
 * input already rendered above it in the main panel — the question's actual substance:
 * option lists, matrix rows/columns, rich text body, image asset, consent copy, etc.
 * Returns null for field types with nothing beyond the label (email, time, signature,
 * address, phone, website, number). */
function ContentExtras({
  formId,
  field,
  canEdit,
  fields,
  onUpdateField,
  onSetColumnLayoutColumns,
}: TypeSpecificSettingsProps) {
  switch (field.type) {
    case 'multi_choice':
    case 'checkbox':
    case 'dropdown':
      return (
        <>
          <div className="settings-subsection">
            <p className="settings-subsection-title">Options</p>
            <OptionsEditor
              options={field.options}
              canEdit={canEdit}
              onChange={(options) => onUpdateField(field.id, { options })}
            />
          </div>
          {field.type === 'dropdown' ? (
            <label className="settings-field">
              <span className="settings-label">Placeholder (optional)</span>
              <input
                className="text-input"
                placeholder="Select an option"
                disabled={!canEdit}
                value={field.placeholder ?? ''}
                onChange={(event) =>
                  onUpdateField(field.id, { placeholder: event.target.value || undefined })
                }
              />
            </label>
          ) : null}
          {field.type === 'multi_choice' || field.type === 'dropdown' ? (
            <label className="settings-field">
              <span className="settings-label">Default selection (optional)</span>
              <select
                className="text-input"
                disabled={!canEdit}
                value={field.defaultValue ?? ''}
                onChange={(event) =>
                  onUpdateField(field.id, { defaultValue: event.target.value || undefined })
                }
              >
                <option value="">None</option>
                {field.options.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </>
      );

    case 'short_text':
    case 'email':
    case 'phone':
    case 'website':
      return (
        <div className="settings-inline-fields">
          <label className="settings-field">
            <span className="settings-label">Placeholder (optional)</span>
            <input
              className="text-input"
              placeholder="Shown inside the empty input"
              disabled={!canEdit}
              value={field.placeholder ?? ''}
              onChange={(event) =>
                onUpdateField(field.id, { placeholder: event.target.value || undefined })
              }
            />
          </label>
          <label className="settings-field">
            <span className="settings-label">Default value (optional)</span>
            <input
              className="text-input"
              disabled={!canEdit}
              value={field.defaultValue ?? ''}
              onChange={(event) =>
                onUpdateField(field.id, { defaultValue: event.target.value || undefined })
              }
            />
          </label>
          {field.type === 'phone' ? (
            <label className="settings-field">
              <span className="settings-label">Country code hint (optional)</span>
              <input
                className="text-input"
                placeholder="+1"
                disabled={!canEdit}
                value={field.defaultCountryCode ?? ''}
                onChange={(event) =>
                  onUpdateField(field.id, {
                    defaultCountryCode: event.target.value || undefined,
                  })
                }
              />
            </label>
          ) : null}
        </div>
      );

    case 'paragraph':
      return (
        <div className="settings-inline-fields">
          <label className="settings-field">
            <span className="settings-label">Placeholder (optional)</span>
            <input
              className="text-input"
              placeholder="Shown inside the empty textarea"
              disabled={!canEdit}
              value={field.placeholder ?? ''}
              onChange={(event) =>
                onUpdateField(field.id, { placeholder: event.target.value || undefined })
              }
            />
          </label>
          <label className="settings-field">
            <span className="settings-label">Default value (optional)</span>
            <input
              className="text-input"
              disabled={!canEdit}
              value={field.defaultValue ?? ''}
              onChange={(event) =>
                onUpdateField(field.id, { defaultValue: event.target.value || undefined })
              }
            />
          </label>
        </div>
      );

    case 'number':
      return (
        <div className="settings-inline-fields">
          <label className="settings-field">
            <span className="settings-label">Placeholder (optional)</span>
            <input
              className="text-input"
              disabled={!canEdit}
              value={field.placeholder ?? ''}
              onChange={(event) =>
                onUpdateField(field.id, { placeholder: event.target.value || undefined })
              }
            />
          </label>
          <label className="settings-field">
            <span className="settings-label">Default value (optional)</span>
            <input
              className="text-input"
              type="number"
              disabled={!canEdit}
              value={field.defaultValue ?? ''}
              onChange={(event) =>
                onUpdateField(field.id, { defaultValue: toOptionalNumber(event.target.value) })
              }
            />
          </label>
          <label className="settings-field">
            <span className="settings-label">Prefix (optional)</span>
            <input
              className="text-input"
              placeholder="$"
              maxLength={8}
              disabled={!canEdit}
              value={field.prefix ?? ''}
              onChange={(event) =>
                onUpdateField(field.id, { prefix: event.target.value || undefined })
              }
            />
          </label>
          <label className="settings-field">
            <span className="settings-label">Suffix (optional)</span>
            <input
              className="text-input"
              placeholder="/mo"
              maxLength={8}
              disabled={!canEdit}
              value={field.suffix ?? ''}
              onChange={(event) =>
                onUpdateField(field.id, { suffix: event.target.value || undefined })
              }
            />
          </label>
        </div>
      );

    case 'address':
      return (
        <label className="settings-toggle-row">
          <span className="settings-label">Include country field</span>
          <input
            type="checkbox"
            checked={field.includeCountry ?? false}
            disabled={!canEdit}
            onChange={(event) => onUpdateField(field.id, { includeCountry: event.target.checked })}
          />
        </label>
      );

    case 'choice_matrix':
      return (
        <>
          <div className="settings-subsection">
            <p className="settings-subsection-title">Rows</p>
            <OptionsEditor
              options={field.rows}
              canEdit={canEdit}
              onChange={(rows) => onUpdateField(field.id, { rows })}
            />
          </div>
          <div className="settings-subsection">
            <p className="settings-subsection-title">Columns (shared ratings)</p>
            <OptionsEditor
              options={field.columns}
              canEdit={canEdit}
              onChange={(columns) => onUpdateField(field.id, { columns })}
            />
          </div>
        </>
      );

    case 'section_break':
      return (
        <label className="settings-field">
          <span className="settings-label">Instruction text (optional)</span>
          <textarea
            className="text-input"
            rows={4}
            placeholder="Important guidance shown below the section heading"
            disabled={!canEdit}
            value={field.helpText ?? ''}
            onChange={(event) =>
              onUpdateField(field.id, { helpText: event.target.value || undefined })
            }
          />
        </label>
      );

    case 'column_layout':
      return (
        <>
          <div className="settings-width-options">
            {COLUMN_COUNTS.map((count) => (
              <label key={count} className="settings-width-option">
                <input
                  type="radio"
                  name={`column-count-${field.id}`}
                  checked={field.columns === count}
                  disabled={!canEdit}
                  onChange={() => onSetColumnLayoutColumns(field.id, count)}
                />
                {COLUMN_LAYOUT_LABELS[count]}
              </label>
            ))}
          </div>
          <p className="field-card-help">
            Click a field inside the row to change its type, label, and validation.
          </p>
        </>
      );

    case 'static_text':
      return (
        <>
          <label className="settings-field">
            <span className="settings-label">Heading (optional)</span>
            <input
              className="text-input"
              placeholder="Optional bold heading"
              disabled={!canEdit}
              value={field.label ?? ''}
              onChange={(event) =>
                onUpdateField(field.id, { label: event.target.value || undefined })
              }
            />
          </label>
          <label className="settings-toggle-row">
            <span className="settings-label">Include body text</span>
            <input
              type="checkbox"
              checked={field.showBody !== false}
              disabled={!canEdit}
              onChange={(event) => onUpdateField(field.id, { showBody: event.target.checked })}
            />
          </label>
          {field.showBody !== false ? (
            // Not a <label> — RichTextEditor's first descendant is a real <button> (Undo),
            // and clicking a <label>'s text forwards a synthetic click to the first labelable
            // control inside it, which would silently fire an undo on click.
            <div className="settings-field">
              <span className="settings-label">Body</span>
              <RichTextEditor
                value={field.body}
                onChange={(html) => onUpdateField(field.id, { body: html })}
                disabled={!canEdit}
                fields={fields}
                excludeFieldId={field.id}
              />
            </div>
          ) : null}
        </>
      );

    case 'image':
      return (
        <>
          <FieldImageUpload
            formId={formId}
            fieldId={field.id}
            imageStorageKey={field.imageStorageKey}
            canEdit={canEdit}
            onUploaded={(storageKey) => onUpdateField(field.id, { imageStorageKey: storageKey })}
            onRemove={() => onUpdateField(field.id, { imageStorageKey: undefined })}
          />
          <label className="settings-field">
            <span className="settings-label">Alt text</span>
            <input
              className="text-input"
              placeholder="Describe the image for accessibility"
              disabled={!canEdit}
              value={field.alt ?? ''}
              onChange={(event) =>
                onUpdateField(field.id, { alt: event.target.value || undefined })
              }
            />
          </label>
          <label className="settings-field">
            <span className="settings-label">Link URL (optional)</span>
            <input
              className="text-input"
              type="url"
              placeholder="https://example.com"
              disabled={!canEdit}
              value={field.linkUrl ?? ''}
              onChange={(event) =>
                onUpdateField(field.id, { linkUrl: event.target.value || undefined })
              }
            />
            <span className="settings-field-hint">
              Makes the image clickable, opening this URL in a new tab.
            </span>
          </label>
        </>
      );

    case 'legal':
      return (
        <>
          <label className="settings-field">
            <span className="settings-label">Consent text</span>
            <textarea
              className="text-input"
              rows={3}
              disabled={!canEdit}
              value={field.consentText}
              onChange={(event) => onUpdateField(field.id, { consentText: event.target.value })}
            />
          </label>
          <div className="settings-inline-fields">
            <label className="settings-field">
              <span className="settings-label">Link text (optional)</span>
              <input
                className="text-input"
                placeholder="Terms of Service"
                disabled={!canEdit}
                value={field.linkLabel ?? ''}
                onChange={(event) =>
                  onUpdateField(field.id, { linkLabel: event.target.value || undefined })
                }
              />
            </label>
            <label className="settings-field">
              <span className="settings-label">Link URL (optional)</span>
              <input
                className="text-input"
                placeholder="https://example.com/terms"
                disabled={!canEdit}
                value={field.linkUrl ?? ''}
                onChange={(event) =>
                  onUpdateField(field.id, { linkUrl: event.target.value || undefined })
                }
              />
            </label>
          </div>
        </>
      );

    case 'hidden':
      return (
        <>
          <label className="settings-field">
            <span className="settings-label">Populate from URL parameter (optional)</span>
            <input
              className="text-input"
              placeholder="e.g. ref"
              disabled={!canEdit}
              value={field.sourceParam ?? ''}
              onChange={(event) =>
                onUpdateField(field.id, { sourceParam: event.target.value || undefined })
              }
            />
            <span className="settings-field-hint">
              If the form URL includes <code>?{field.sourceParam || 'param'}=value</code>, that
              value is captured automatically — useful for campaign/referral tracking.
            </span>
          </label>
          <label className="settings-field">
            <span className="settings-label">Default value (optional)</span>
            <input
              className="text-input"
              placeholder="Used when the URL parameter isn't present"
              disabled={!canEdit}
              value={field.defaultValue ?? ''}
              onChange={(event) =>
                onUpdateField(field.id, { defaultValue: event.target.value || undefined })
              }
            />
          </label>
        </>
      );

    default:
      return null;
  }
}

/** Everything that belongs in the Validation & behavior group beyond the shared
 * Required toggle / Help text already rendered above it — type-specific constraints.
 * Returns null for field types with no extra validation surface. */
function ValidationExtras({ field, canEdit, onUpdateField }: TypeSpecificSettingsProps) {
  switch (field.type) {
    case 'multi_choice':
    case 'checkbox':
    case 'dropdown':
      return (
        <>
          <label className="settings-toggle-row">
            <span className="settings-label">Randomize option order</span>
            <input
              type="checkbox"
              checked={field.randomizeOrder ?? false}
              disabled={!canEdit}
              onChange={(event) =>
                onUpdateField(field.id, { randomizeOrder: event.target.checked })
              }
            />
          </label>
          <label className="settings-toggle-row">
            <span className="settings-label">Add an "Other" option</span>
            <input
              type="checkbox"
              checked={field.allowOther ?? false}
              disabled={!canEdit}
              onChange={(event) => onUpdateField(field.id, { allowOther: event.target.checked })}
            />
          </label>
          {field.type === 'checkbox' ? (
            <div className="settings-inline-fields">
              <label className="settings-field">
                <span className="settings-label">Min selections</span>
                <input
                  className="text-input"
                  type="number"
                  min={0}
                  disabled={!canEdit}
                  value={field.minSelected ?? ''}
                  onChange={(event) =>
                    onUpdateField(field.id, { minSelected: toOptionalNumber(event.target.value) })
                  }
                />
              </label>
              <label className="settings-field">
                <span className="settings-label">Max selections</span>
                <input
                  className="text-input"
                  type="number"
                  min={1}
                  disabled={!canEdit}
                  value={field.maxSelected ?? ''}
                  onChange={(event) =>
                    onUpdateField(field.id, { maxSelected: toOptionalNumber(event.target.value) })
                  }
                />
              </label>
            </div>
          ) : null}
        </>
      );

    case 'short_text':
    case 'paragraph':
      return (
        <div className="settings-inline-fields">
          <label className="settings-field">
            <span className="settings-label">Min length</span>
            <input
              className="text-input"
              type="number"
              min={0}
              disabled={!canEdit}
              value={field.validation?.minLength ?? ''}
              onChange={(event) =>
                onUpdateField(field.id, {
                  validation: {
                    ...field.validation,
                    minLength: toOptionalNumber(event.target.value),
                  },
                })
              }
            />
          </label>
          <label className="settings-field">
            <span className="settings-label">Max length</span>
            <input
              className="text-input"
              type="number"
              min={0}
              disabled={!canEdit}
              value={field.validation?.maxLength ?? ''}
              onChange={(event) =>
                onUpdateField(field.id, {
                  validation: {
                    ...field.validation,
                    maxLength: toOptionalNumber(event.target.value),
                  },
                })
              }
            />
          </label>
        </div>
      );

    case 'number':
      return (
        <div className="settings-inline-fields">
          <label className="settings-field">
            <span className="settings-label">Min</span>
            <input
              className="text-input"
              type="number"
              disabled={!canEdit}
              value={field.validation?.min ?? ''}
              onChange={(event) =>
                onUpdateField(field.id, {
                  validation: { ...field.validation, min: toOptionalNumber(event.target.value) },
                })
              }
            />
          </label>
          <label className="settings-field">
            <span className="settings-label">Max</span>
            <input
              className="text-input"
              type="number"
              disabled={!canEdit}
              value={field.validation?.max ?? ''}
              onChange={(event) =>
                onUpdateField(field.id, {
                  validation: { ...field.validation, max: toOptionalNumber(event.target.value) },
                })
              }
            />
          </label>
          <label className="settings-field">
            <span className="settings-label">Step</span>
            <input
              className="text-input"
              type="number"
              min={0}
              disabled={!canEdit}
              value={field.validation?.step ?? ''}
              onChange={(event) =>
                onUpdateField(field.id, {
                  validation: { ...field.validation, step: toOptionalNumber(event.target.value) },
                })
              }
            />
          </label>
        </div>
      );

    case 'date':
      return (
        <>
          <div className="settings-inline-fields">
            <label className="settings-field">
              <span className="settings-label">Earliest date</span>
              <input
                className="text-input"
                type="date"
                disabled={!canEdit}
                value={field.validation?.minDate ?? ''}
                onChange={(event) =>
                  onUpdateField(field.id, {
                    validation: { ...field.validation, minDate: event.target.value || undefined },
                  })
                }
              />
            </label>
            <label className="settings-field">
              <span className="settings-label">Latest date</span>
              <input
                className="text-input"
                type="date"
                disabled={!canEdit}
                value={field.validation?.maxDate ?? ''}
                onChange={(event) =>
                  onUpdateField(field.id, {
                    validation: { ...field.validation, maxDate: event.target.value || undefined },
                  })
                }
              />
            </label>
          </div>
          <div className="settings-inline-fields">
            <label className="settings-field">
              <span className="settings-label">Default value (optional)</span>
              <select
                className="text-input"
                disabled={!canEdit}
                value={field.defaultValue === 'today' ? 'today' : field.defaultValue ? 'fixed' : ''}
                onChange={(event) => {
                  const choice = event.target.value;
                  if (choice === '') {
                    onUpdateField(field.id, { defaultValue: undefined });
                  } else if (choice === 'today') {
                    onUpdateField(field.id, { defaultValue: 'today' });
                  } else {
                    onUpdateField(field.id, {
                      defaultValue: new Date().toISOString().slice(0, 10),
                    });
                  }
                }}
              >
                <option value="">None</option>
                <option value="today">Today (at submission time)</option>
                <option value="fixed">Fixed date...</option>
              </select>
            </label>
            {field.defaultValue && field.defaultValue !== 'today' ? (
              <label className="settings-field">
                <span className="settings-label">Fixed date</span>
                <input
                  className="text-input"
                  type="date"
                  disabled={!canEdit}
                  value={field.defaultValue}
                  onChange={(event) =>
                    onUpdateField(field.id, { defaultValue: event.target.value || undefined })
                  }
                />
              </label>
            ) : null}
          </div>
          <label className="settings-field">
            <span className="settings-label">Display format</span>
            <select
              className="text-input"
              disabled={!canEdit}
              value={field.displayFormat ?? 'iso'}
              onChange={(event) =>
                onUpdateField(field.id, {
                  displayFormat: event.target.value as (typeof DATE_DISPLAY_FORMATS)[number],
                })
              }
            >
              {DATE_DISPLAY_FORMATS.map((format) => (
                <option key={format} value={format}>
                  {DATE_DISPLAY_FORMAT_LABEL[format]}
                </option>
              ))}
            </select>
          </label>
        </>
      );

    case 'file_upload':
      return (
        <>
          <label className="settings-toggle-row">
            <span className="settings-label">Allow multiple files</span>
            <input
              type="checkbox"
              checked={field.multiple ?? false}
              disabled={!canEdit}
              onChange={(event) =>
                onUpdateField(field.id, {
                  multiple: event.target.checked,
                  maxFiles: event.target.checked ? field.maxFiles : undefined,
                })
              }
            />
          </label>
          {field.multiple ? (
            <label className="settings-field">
              <span className="settings-label">Max number of files (optional)</span>
              <input
                className="text-input"
                type="number"
                min={2}
                max={20}
                placeholder="No limit"
                disabled={!canEdit}
                value={field.maxFiles ?? ''}
                onChange={(event) =>
                  onUpdateField(field.id, { maxFiles: toOptionalNumber(event.target.value) })
                }
              />
            </label>
          ) : null}
          <label className="settings-field">
            <span className="settings-label">Max size (MB)</span>
            <input
              className="text-input"
              type="number"
              min={0}
              max={100}
              disabled={!canEdit}
              value={field.validation?.maxSizeMb ?? ''}
              onChange={(event) =>
                onUpdateField(field.id, {
                  validation: {
                    ...field.validation,
                    maxSizeMb: toOptionalNumber(event.target.value),
                  },
                })
              }
            />
          </label>
          <label className="settings-field">
            <span className="settings-label">Accepted types (comma-separated)</span>
            <input
              className="text-input"
              placeholder=".pdf, image/png"
              disabled={!canEdit}
              value={field.validation?.acceptedTypes?.join(', ') ?? ''}
              onChange={(event) => {
                const acceptedTypes = event.target.value
                  .split(',')
                  .map((entry) => entry.trim())
                  .filter((entry) => entry.length > 0);
                onUpdateField(field.id, {
                  validation: {
                    ...field.validation,
                    acceptedTypes: acceptedTypes.length > 0 ? acceptedTypes : undefined,
                  },
                });
              }}
            />
          </label>
        </>
      );

    case 'rating':
      return (
        <label className="settings-field">
          <span className="settings-label">Number of stars</span>
          <input
            className="text-input"
            type="number"
            min={RATING_MAX_MIN}
            max={RATING_MAX_MAX}
            disabled={!canEdit}
            value={field.maxRating ?? 5}
            onChange={(event) => {
              const raw = Number(event.target.value);
              const clamped = Math.min(RATING_MAX_MAX, Math.max(RATING_MAX_MIN, raw));
              onUpdateField(field.id, { maxRating: Number.isNaN(raw) ? undefined : clamped });
            }}
          />
        </label>
      );

    case 'opinion_scale':
      return (
        <>
          <div className="settings-inline-fields">
            <label className="settings-field">
              <span className="settings-label">Scale min</span>
              <input
                className="text-input"
                type="number"
                min={OPINION_SCALE_MIN_BOUND}
                max={OPINION_SCALE_MAX_BOUND}
                disabled={!canEdit}
                value={field.scaleMin ?? 0}
                onChange={(event) =>
                  onUpdateField(field.id, { scaleMin: toOptionalNumber(event.target.value) })
                }
              />
            </label>
            <label className="settings-field">
              <span className="settings-label">Scale max</span>
              <input
                className="text-input"
                type="number"
                min={OPINION_SCALE_MIN_BOUND}
                max={OPINION_SCALE_MAX_BOUND}
                disabled={!canEdit}
                value={field.scaleMax ?? 10}
                onChange={(event) =>
                  onUpdateField(field.id, { scaleMax: toOptionalNumber(event.target.value) })
                }
              />
            </label>
          </div>
          <div className="settings-inline-fields">
            <label className="settings-field">
              <span className="settings-label">Min label (optional)</span>
              <input
                className="text-input"
                placeholder="Not likely"
                disabled={!canEdit}
                value={field.minLabel ?? ''}
                onChange={(event) =>
                  onUpdateField(field.id, { minLabel: event.target.value || undefined })
                }
              />
            </label>
            <label className="settings-field">
              <span className="settings-label">Max label (optional)</span>
              <input
                className="text-input"
                placeholder="Very likely"
                disabled={!canEdit}
                value={field.maxLabel ?? ''}
                onChange={(event) =>
                  onUpdateField(field.id, { maxLabel: event.target.value || undefined })
                }
              />
            </label>
          </div>
          <label className="settings-field">
            <span className="settings-label">Midpoint label (optional)</span>
            <input
              className="text-input"
              placeholder="Neutral"
              disabled={!canEdit}
              value={field.midLabel ?? ''}
              onChange={(event) =>
                onUpdateField(field.id, { midLabel: event.target.value || undefined })
              }
            />
          </label>
        </>
      );

    default:
      return null;
  }
}

/** Appearance-group content — kept as its own function (rather than inlined where it's
 * used) so `field.type === '...'` narrowing resolves cleanly against a plain function
 * parameter instead of interacting with the half-dozen other aliased `isXyz` booleans
 * already in scope in the main panel component below. */
function AppearanceExtras({ field, canEdit, onUpdateField }: TypeSpecificSettingsProps) {
  if (field.type === 'static_text') {
    return (
      <>
        <div className="settings-subsection">
          <p className="settings-subsection-title">Heading style</p>
          <TextStyleControls
            radioGroupName={`static-text-heading-align-${field.id}`}
            fontWeight={field.headingFontWeight ?? 'default'}
            onFontWeightChange={(value) => onUpdateField(field.id, { headingFontWeight: value })}
            fontFamily={field.headingFontFamily ?? 'default'}
            onFontFamilyChange={(value) => onUpdateField(field.id, { headingFontFamily: value })}
            fontSize={field.headingFontSize}
            onFontSizeChange={(value) => onUpdateField(field.id, { headingFontSize: value })}
            color={field.headingColor}
            onColorChange={(value) => onUpdateField(field.id, { headingColor: value })}
            align={field.headingAlign ?? 'left'}
            onAlignChange={(value) => onUpdateField(field.id, { headingAlign: value })}
            canEdit={canEdit}
          />
        </div>
        {field.showBody !== false ? (
          <div className="settings-subsection">
            <p className="settings-subsection-title">Body style</p>
            <TextStyleControls
              radioGroupName={`static-text-body-align-${field.id}`}
              fontWeight={field.bodyFontWeight ?? 'default'}
              onFontWeightChange={(value) => onUpdateField(field.id, { bodyFontWeight: value })}
              fontFamily={field.bodyFontFamily ?? 'default'}
              onFontFamilyChange={(value) => onUpdateField(field.id, { bodyFontFamily: value })}
              fontSize={field.bodyFontSize}
              onFontSizeChange={(value) => onUpdateField(field.id, { bodyFontSize: value })}
              color={field.bodyColor}
              onColorChange={(value) => onUpdateField(field.id, { bodyColor: value })}
              align={field.bodyAlign ?? 'left'}
              onAlignChange={(value) => onUpdateField(field.id, { bodyAlign: value })}
              canEdit={canEdit}
            />
          </div>
        ) : null}
        <div className="settings-subsection">
          <p className="settings-subsection-title">Container</p>
          <FieldColorSettings field={field} canEdit={canEdit} onUpdateField={onUpdateField} />
        </div>
      </>
    );
  }

  if (field.type === 'image') {
    return (
      <>
        <label className="settings-field">
          <span className="settings-label">Size</span>
          <select
            className="text-input"
            disabled={!canEdit}
            value={field.imageSize ?? 'default'}
            onChange={(event) =>
              onUpdateField(field.id, { imageSize: event.target.value as ImageSize })
            }
          >
            {IMAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>
                {IMAGE_SIZE_LABEL[size]}
              </option>
            ))}
          </select>
        </label>
        <label className="settings-field">
          <span className="settings-label">Spacing below</span>
          <select
            className="text-input"
            disabled={!canEdit}
            value={field.imageSpacing ?? 'default'}
            onChange={(event) =>
              onUpdateField(field.id, { imageSpacing: event.target.value as ImageSpacing })
            }
          >
            {IMAGE_SPACING_OPTIONS.map((spacing) => (
              <option key={spacing} value={spacing}>
                {IMAGE_SPACING_LABEL[spacing]}
              </option>
            ))}
          </select>
        </label>
        <div className="settings-width-options">
          {IMAGE_ALIGN_OPTIONS.map((option) => (
            <label key={option} className="settings-width-option">
              <input
                type="radio"
                name={`image-align-${field.id}`}
                checked={(field.align ?? 'center') === option}
                disabled={!canEdit}
                onChange={() => onUpdateField(field.id, { align: option as ImageAlign })}
              />
              {IMAGE_ALIGN_LABEL[option]}
            </label>
          ))}
        </div>
      </>
    );
  }

  if (field.type === 'rating') {
    return (
      <>
        <label className="settings-field">
          <span className="settings-label">Icon</span>
          <select
            className="text-input"
            disabled={!canEdit}
            value={field.icon ?? 'star'}
            onChange={(event) =>
              onUpdateField(field.id, { icon: event.target.value as RatingIcon })
            }
          >
            {RATING_ICON_OPTIONS.map((icon) => (
              <option key={icon} value={icon}>
                {RATING_ICON_LABEL[icon]}
              </option>
            ))}
          </select>
        </label>
        <FieldColorPicker
          label="Icon color"
          value={field.color}
          defaultColor="#f5a623"
          canEdit={canEdit}
          onChange={(value) => onUpdateField(field.id, { color: value })}
        />
      </>
    );
  }

  return <FieldColorSettings field={field} canEdit={canEdit} onUpdateField={onUpdateField} />;
}

interface FieldSettingsPanelProps {
  formId: string;
  schema: FormSchema;
  field: FormField | null;
  canEdit: boolean;
  onUpdateField: (fieldId: string, patch: FieldPatch) => void;
  onDuplicateField: (fieldId: string) => void;
  onReplaceFieldType: (fieldId: string, type: FieldType) => void;
  onSetColumnLayoutColumns: (layoutId: string, columns: ColumnCount) => void;
  onSetConditionalRule: (rule: ConditionalRule) => void;
  onClearConditionalRule: (fieldId: string) => void;
}

export function FieldSettingsPanel({
  formId,
  schema,
  field,
  canEdit,
  onUpdateField,
  onDuplicateField,
  onReplaceFieldType,
  onSetColumnLayoutColumns,
  onSetConditionalRule,
  onClearConditionalRule,
}: FieldSettingsPanelProps) {
  if (!field) {
    return (
      <div className="settings-panel settings-panel--empty">
        <div className="settings-panel-empty-state">
          <p className="settings-panel-empty-title">No field selected</p>
          <p className="settings-panel-empty">
            Click a field on the canvas to edit its label, validation, colors, and conditional
            logic.
          </p>
        </div>
      </div>
    );
  }

  const isLayoutOnly = isLayoutOnlyField(field.type);
  const isImage = field.type === 'image';
  const isStaticText = field.type === 'static_text';
  const isSectionBreak = field.type === 'section_break';
  const isColumnLayout = field.type === 'column_layout';
  const isHidden = field.type === 'hidden';
  const isColumnChild = Boolean(findParentColumnLayout(schema, field.id));

  const typeSpecificProps: TypeSpecificSettingsProps = {
    formId,
    field,
    canEdit,
    fields: schema.fields,
    onUpdateField,
    onSetColumnLayoutColumns,
  };

  // Hidden fields and column layouts carry no respondent-facing input, so "required" /
  // help text / length-and-range validation are all meaningless for them — same
  // treatment section_break/image/static_text already got as isLayoutOnly, extended to
  // hidden (which isn't in LAYOUT_ONLY_FIELD_TYPES itself — see the schema comment on
  // hiddenFieldSchema for why: it does carry a real answer, just no visible control).
  const showBehaviorGroup = !isLayoutOnly && !isStaticText && !isHidden;
  const showWidthGroup = showBehaviorGroup && !isColumnChild;
  const contentExtras = ContentExtras(typeSpecificProps);
  const validationExtras = showBehaviorGroup ? ValidationExtras(typeSpecificProps) : null;

  // Every real input field, plus section_break, static_text, and image (all three are
  // stylable containers/surfaces even though image and section_break carry no answer),
  // but never a column layout (no surface of its own to color) or a hidden field
  // (nothing rendered).
  const showAppearanceGroup =
    (isSectionBreak || isStaticText || isImage || !isLayoutOnly) && !isHidden;

  return (
    <div className="settings-panel" key={field.id}>
      <div className="settings-panel-header">
        <p className="settings-panel-title">
          {isSectionBreak
            ? 'Section settings'
            : isColumnLayout
              ? 'Column section settings'
              : isImage
                ? 'Image settings'
                : isStaticText
                  ? 'Formatted text settings'
                  : isHidden
                    ? 'Hidden field settings'
                    : 'Field settings'}
        </p>
        {canEdit && !isColumnChild ? (
          <button
            type="button"
            className="button button--ghost button--small"
            onClick={() => onDuplicateField(field.id)}
          >
            Duplicate
          </button>
        ) : null}
      </div>

      {isColumnChild ? (
        <label className="settings-field">
          <span className="settings-label">Field type</span>
          <select
            className="text-input"
            value={field.type}
            disabled={!canEdit}
            onChange={(event) => onReplaceFieldType(field.id, event.target.value as FieldType)}
          >
            {COLUMN_CHILD_FIELD_TYPES.map((type) => (
              <option key={type} value={type}>
                {FIELD_TYPE_LABELS[type]}
              </option>
            ))}
          </select>
          <span className="settings-field-hint">
            Or drag a field from the palette onto this column cell to change its type.
          </span>
        </label>
      ) : null}

      <SettingsGroup title="Content" icon={<ContentIcon />} defaultOpen>
        {!isStaticText ? (
          <label className="settings-field">
            <span className="settings-label">
              {isSectionBreak || isColumnLayout
                ? 'Section title'
                : isImage
                  ? 'Caption (optional)'
                  : isHidden
                    ? 'Internal name'
                    : 'Label'}
            </span>
            <input
              className="text-input"
              value={field.label}
              disabled={!canEdit}
              onChange={(event) => onUpdateField(field.id, { label: event.target.value })}
            />
            {isHidden ? (
              <span className="settings-field-hint">
                Only shown to you in the builder and submission exports — respondents never see
                this.
              </span>
            ) : null}
          </label>
        ) : null}
        {contentExtras}
      </SettingsGroup>

      {showBehaviorGroup ? (
        <SettingsGroup title="Validation & behavior" icon={<ValidationIcon />} defaultOpen>
          <label className="settings-toggle-row">
            <span className="settings-label">Required</span>
            <input
              type="checkbox"
              checked={field.required}
              disabled={!canEdit}
              onChange={(event) => onUpdateField(field.id, { required: event.target.checked })}
            />
          </label>

          {'helpText' in field ? (
            <label className="settings-field">
              <span className="settings-label">Help text</span>
              <input
                className="text-input"
                value={field.helpText ?? ''}
                disabled={!canEdit}
                onChange={(event) => onUpdateField(field.id, { helpText: event.target.value })}
              />
            </label>
          ) : null}

          {validationExtras}
        </SettingsGroup>
      ) : null}

      {showWidthGroup ? (
        <SettingsGroup title="Layout" icon={<LayoutIcon />} defaultOpen={false}>
          <div className="settings-width-options">
            {FIELD_WIDTHS.map((width) => (
              <label key={width} className="settings-width-option">
                <input
                  type="radio"
                  name={`field-width-${field.id}`}
                  checked={(field.width ?? 'full') === width}
                  disabled={!canEdit}
                  onChange={() => onUpdateField(field.id, { width })}
                />
                {FIELD_WIDTH_LABEL[width]}
              </label>
            ))}
          </div>
        </SettingsGroup>
      ) : null}

      {showAppearanceGroup ? (
        <SettingsGroup title="Appearance" icon={<AppearanceIcon />} defaultOpen={false}>
          <AppearanceExtras {...typeSpecificProps} />
        </SettingsGroup>
      ) : null}

      {!isHidden ? (
        <SettingsGroup title="Logic" icon={<LogicIcon />} defaultOpen={false}>
          <ConditionalLogicEditor
            schema={schema}
            field={field}
            canEdit={canEdit}
            onSetRule={onSetConditionalRule}
            onClearRule={() => onClearConditionalRule(field.id)}
          />
        </SettingsGroup>
      ) : null}
    </div>
  );
}
