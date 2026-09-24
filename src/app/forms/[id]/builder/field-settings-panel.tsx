'use client';

import type { ReactNode } from 'react';
import { FieldColorPicker } from '@/app/forms/[id]/builder/field-color-picker';
import { FieldColorSettings } from '@/app/forms/[id]/builder/field-color-settings';
import { FieldImageUpload } from '@/app/forms/[id]/builder/field-image-upload';
import {
  COLUMN_CHILD_FIELD_TYPES,
  COLUMN_LAYOUT_LABELS,
  FIELD_TYPE_LABELS,
} from '@/app/forms/[id]/builder/field-meta';
import { PaletteIcon } from '@/app/forms/[id]/builder/field-palette';
import { OptionsEditor } from '@/app/forms/[id]/builder/options-editor';
import { PictureChoiceOptionsEditor } from '@/app/forms/[id]/builder/picture-choice-options-editor';
import { QuestionTableRowsEditor } from '@/app/forms/[id]/builder/question-table-rows-editor';
import { RichTextEditor } from '@/app/forms/[id]/builder/rich-text-editor';
import { type FieldPatch, findParentColumnLayout } from '@/app/forms/[id]/builder/schema-mutations';
import { TableColumnsEditor } from '@/app/forms/[id]/builder/table-columns-editor';
import { describeCalculationFormula } from '@/lib/forms/calculation';
import { FIELD_WIDTH_LABEL, FIELD_WIDTHS } from '@/lib/forms/field-width';
import {
  COLUMN_COUNTS,
  type ColumnCount,
  DATE_DISPLAY_FORMAT_LABEL,
  DATE_DISPLAY_FORMATS,
  DEFAULT_DIVIDER_THICKNESS_PX,
  DEFAULT_DIVIDER_WIDTH_PX,
  DEFAULT_FIELD_TEXT_COLOR,
  DIVIDER_CAPTION_POSITIONS,
  DIVIDER_THICKNESS_MAX_PX,
  DIVIDER_THICKNESS_MIN_PX,
  DIVIDER_WIDTH_MAX_PX,
  DIVIDER_WIDTH_MIN_PX,
  type DividerCaptionPosition,
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
  TABLE_ROWS_MAX,
  TEXT_ALIGN_LABEL,
  TEXT_ALIGN_OPTIONS,
  TEXT_FONT_SIZE_MAX_PX,
  TEXT_FONT_SIZE_MIN_PX,
  type TextAlign,
} from '@/lib/forms/schema';
import { maskPlaceholder } from '@/lib/forms/text-mask';

// ---------------------------------------------------------------------------
// This panel is organized into named, collapsible groups — Content, Validation &
// behavior, Layout, Appearance, Logic — rather than one flat stack of controls. Each
// field type only renders the groups that actually apply to it (a section break has no
// Validation group; an image field has no Logic-eligible answer... it still gets Logic
// since conditional rules can target any field, but never a Validation group). See
// SettingsGroup below for the shared collapsible-section chrome every group uses.
// ---------------------------------------------------------------------------

interface TypeSpecificSettingsProps {
  /** Exactly one of formId/templateId is set, depending on whether this panel is
   * editing a real tenant Form or a platform-admin FormTemplate — see the doc comment
   * on FieldSettingsPanelProps below. */
  formId?: string;
  templateId?: string;
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

    case 'calculation': {
      const candidateFields = Object.values(fields).filter(
        (candidate) =>
          candidate.id !== field.id &&
          !isLayoutOnlyField(candidate.type) &&
          candidate.type !== 'calculation',
      );
      return (
        <>
          <label className="settings-field">
            <span className="settings-label">Formula</span>
            <textarea
              className="text-input"
              rows={3}
              placeholder="{field} * {field} + 10"
              disabled={!canEdit}
              value={field.formula}
              onChange={(event) => onUpdateField(field.id, { formula: event.target.value || '0' })}
            />
            <span className="settings-field-hint">
              Arithmetic only: +, -, *, /, and parentheses. Preview:{' '}
              <code>{describeCalculationFormula(field.formula, fields)}</code>
            </span>
          </label>
          {candidateFields.length > 0 ? (
            <label className="settings-field">
              <span className="settings-label">Insert a field</span>
              <select
                className="text-input"
                disabled={!canEdit}
                value=""
                onChange={(event) => {
                  if (!event.target.value) return;
                  onUpdateField(field.id, {
                    formula: `${field.formula} {${event.target.value}}`.trim(),
                  });
                }}
              >
                <option value="">Choose a field to insert&hellip;</option>
                {candidateFields.map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {candidate.label || 'Untitled field'}
                  </option>
                ))}
              </select>
              <span className="settings-field-hint">
                Appends the field to the end of the formula above — rearrange the text there to
                build the exact expression you need.
              </span>
            </label>
          ) : (
            <p className="field-card-help">
              Add another field to this form first to build a formula.
            </p>
          )}
          <div className="settings-inline-fields">
            <label className="settings-field">
              <span className="settings-label">Decimal places</span>
              <input
                className="text-input"
                type="number"
                min={0}
                max={6}
                disabled={!canEdit}
                value={field.decimalPlaces ?? 2}
                onChange={(event) =>
                  onUpdateField(field.id, { decimalPlaces: toOptionalNumber(event.target.value) })
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
        </>
      );
    }

    case 'masked_text':
      return (
        <div className="settings-inline-fields">
          <label className="settings-field">
            <span className="settings-label">Mask pattern</span>
            <input
              className="text-input"
              placeholder="(###) ###-####"
              disabled={!canEdit}
              value={field.mask}
              onChange={(event) => onUpdateField(field.id, { mask: event.target.value || '#' })}
            />
            <span className="settings-field-hint">
              <code>#</code> = digit, <code>A</code> = letter, <code>*</code> = either. Every other
              character (spaces, dashes, parentheses...) is inserted automatically. Preview:{' '}
              <code>{maskPlaceholder(field.mask)}</code>
            </span>
          </label>
          <label className="settings-field">
            <span className="settings-label">Placeholder (optional)</span>
            <input
              className="text-input"
              placeholder={maskPlaceholder(field.mask)}
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

    case 'yes_no':
      return (
        <div className="settings-inline-fields">
          <label className="settings-field">
            <span className="settings-label">"Yes" button label</span>
            <input
              className="text-input"
              placeholder="Yes"
              disabled={!canEdit}
              value={field.yesLabel ?? ''}
              onChange={(event) =>
                onUpdateField(field.id, { yesLabel: event.target.value || undefined })
              }
            />
          </label>
          <label className="settings-field">
            <span className="settings-label">"No" button label</span>
            <input
              className="text-input"
              placeholder="No"
              disabled={!canEdit}
              value={field.noLabel ?? ''}
              onChange={(event) =>
                onUpdateField(field.id, { noLabel: event.target.value || undefined })
              }
            />
          </label>
          <label className="settings-field">
            <span className="settings-label">Default selection (optional)</span>
            <select
              className="text-input"
              disabled={!canEdit}
              value={field.defaultValue ?? ''}
              onChange={(event) =>
                onUpdateField(field.id, {
                  defaultValue: event.target.value
                    ? (event.target.value as 'yes' | 'no')
                    : undefined,
                })
              }
            >
              <option value="">None</option>
              <option value="yes">{field.yesLabel || 'Yes'}</option>
              <option value="no">{field.noLabel || 'No'}</option>
            </select>
          </label>
        </div>
      );

    case 'ranking':
      return (
        <div className="settings-subsection">
          <p className="settings-subsection-title">Items to rank</p>
          <OptionsEditor
            options={field.options}
            canEdit={canEdit}
            onChange={(options) => onUpdateField(field.id, { options })}
          />
        </div>
      );

    case 'picture_choice':
      return (
        <>
          <div className="settings-subsection">
            <p className="settings-subsection-title">Picture options</p>
            <PictureChoiceOptionsEditor
              options={field.options}
              canEdit={canEdit}
              onChange={(options) => onUpdateField(field.id, { options })}
            />
          </div>
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
        </>
      );

    case 'full_name':
      return (
        <>
          <label className="settings-toggle-row">
            <span className="settings-label">Include prefix (Mr, Mrs, Dr...)</span>
            <input
              type="checkbox"
              checked={field.includePrefix ?? false}
              disabled={!canEdit}
              onChange={(event) => onUpdateField(field.id, { includePrefix: event.target.checked })}
            />
          </label>
          <label className="settings-toggle-row">
            <span className="settings-label">Include middle name</span>
            <input
              type="checkbox"
              checked={field.includeMiddleName ?? false}
              disabled={!canEdit}
              onChange={(event) =>
                onUpdateField(field.id, { includeMiddleName: event.target.checked })
              }
            />
          </label>
        </>
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

    case 'table':
      return (
        <>
          <div className="settings-subsection">
            <p className="settings-subsection-title">Columns</p>
            <TableColumnsEditor
              columns={field.columns}
              canEdit={canEdit}
              onChange={(columns) => onUpdateField(field.id, { columns })}
            />
          </div>
          <div className="settings-inline-fields">
            <label className="settings-field">
              <span className="settings-label">Starting rows</span>
              <input
                className="text-input"
                type="number"
                min={1}
                max={TABLE_ROWS_MAX}
                disabled={!canEdit}
                value={field.defaultRows ?? ''}
                onChange={(event) =>
                  onUpdateField(field.id, { defaultRows: toOptionalNumber(event.target.value) })
                }
              />
              <span className="settings-field-hint">How many empty rows the form starts with.</span>
            </label>
            <label className="settings-field">
              <span className="settings-label">Min rows (optional)</span>
              <input
                className="text-input"
                type="number"
                min={0}
                max={TABLE_ROWS_MAX}
                disabled={!canEdit}
                value={field.minRows ?? ''}
                onChange={(event) =>
                  onUpdateField(field.id, { minRows: toOptionalNumber(event.target.value) })
                }
              />
            </label>
            <label className="settings-field">
              <span className="settings-label">Max rows (optional)</span>
              <input
                className="text-input"
                type="number"
                min={1}
                max={TABLE_ROWS_MAX}
                disabled={!canEdit}
                value={field.maxRows ?? ''}
                onChange={(event) =>
                  onUpdateField(field.id, { maxRows: toOptionalNumber(event.target.value) })
                }
              />
            </label>
          </div>
        </>
      );

    case 'question_table':
      return (
        <>
          <div className="settings-subsection">
            <p className="settings-subsection-title">Questions</p>
            <QuestionTableRowsEditor
              rows={field.rows}
              canEdit={canEdit}
              onChange={(rows) => onUpdateField(field.id, { rows })}
            />
          </div>
          <div className="settings-inline-fields">
            <label className="settings-field">
              <span className="settings-label">Question column label</span>
              <input
                className="text-input"
                placeholder="Field"
                disabled={!canEdit}
                value={field.fieldColumnLabel ?? ''}
                onChange={(event) =>
                  onUpdateField(field.id, { fieldColumnLabel: event.target.value || undefined })
                }
              />
            </label>
            <label className="settings-field">
              <span className="settings-label">Answer column label</span>
              <input
                className="text-input"
                placeholder="Details"
                disabled={!canEdit}
                value={field.valueColumnLabel ?? ''}
                onChange={(event) =>
                  onUpdateField(field.id, { valueColumnLabel: event.target.value || undefined })
                }
              />
            </label>
          </div>
          <div className="settings-subsection">
            <p className="settings-subsection-title">Colors</p>
            <FieldColorPicker
              label="Header background"
              value={field.headerColor}
              defaultColor="#ffffff"
              canEdit={canEdit}
              onChange={(value) => onUpdateField(field.id, { headerColor: value })}
            />
            <FieldColorPicker
              label="Header text color"
              value={field.headerTextColor}
              defaultColor={DEFAULT_FIELD_TEXT_COLOR}
              canEdit={canEdit}
              onChange={(value) => onUpdateField(field.id, { headerTextColor: value })}
            />
            <FieldColorPicker
              label="Answer cell background"
              value={field.valueColor}
              defaultColor="#ffffff"
              canEdit={canEdit}
              onChange={(value) => onUpdateField(field.id, { valueColor: value })}
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

    case 'divider':
      return (
        <>
          <div className="settings-subsection">
            <p className="settings-subsection-title">Size</p>
            <label className="settings-field">
              <span className="settings-label">Width (px)</span>
              <input
                type="number"
                className="text-input"
                disabled={!canEdit}
                min={DIVIDER_WIDTH_MIN_PX}
                max={DIVIDER_WIDTH_MAX_PX}
                value={field.dividerWidthPx ?? DEFAULT_DIVIDER_WIDTH_PX}
                onChange={(event) => {
                  const raw = Number(event.target.value);
                  if (Number.isNaN(raw)) return;
                  onUpdateField(field.id, {
                    dividerWidthPx: Math.min(
                      DIVIDER_WIDTH_MAX_PX,
                      Math.max(DIVIDER_WIDTH_MIN_PX, raw),
                    ),
                  });
                }}
              />
              <span className="settings-field-hint">
                Or drag the handle at the right edge of the line on the canvas.
              </span>
            </label>
            <label className="settings-field">
              <span className="settings-label">Thickness (px)</span>
              <input
                type="number"
                className="text-input"
                disabled={!canEdit}
                min={DIVIDER_THICKNESS_MIN_PX}
                max={DIVIDER_THICKNESS_MAX_PX}
                value={field.thicknessPx ?? DEFAULT_DIVIDER_THICKNESS_PX}
                onChange={(event) => {
                  const raw = Number(event.target.value);
                  if (Number.isNaN(raw)) return;
                  onUpdateField(field.id, {
                    thicknessPx: Math.min(
                      DIVIDER_THICKNESS_MAX_PX,
                      Math.max(DIVIDER_THICKNESS_MIN_PX, raw),
                    ),
                  });
                }}
              />
              <span className="settings-field-hint">
                Or drag the handle at the bottom edge of the line on the canvas.
              </span>
            </label>
          </div>
          <div className="settings-subsection">
            <p className="settings-subsection-title">Caption</p>
            <label className="settings-field">
              <span className="settings-label">Placement</span>
              <select
                className="text-input"
                disabled={!canEdit}
                value={field.captionPosition ?? 'above'}
                onChange={(event) =>
                  onUpdateField(field.id, {
                    captionPosition: event.target.value as DividerCaptionPosition,
                  })
                }
              >
                {DIVIDER_CAPTION_POSITIONS.map((position) => (
                  <option key={position} value={position}>
                    {position === 'above' ? 'Above the line' : 'Below the line'}
                  </option>
                ))}
              </select>
            </label>
            <TextStyleControls
              radioGroupName={`divider-caption-align-${field.id}`}
              fontWeight={field.captionFontWeight ?? 'default'}
              onFontWeightChange={(value) => onUpdateField(field.id, { captionFontWeight: value })}
              fontFamily={field.captionFontFamily ?? 'default'}
              onFontFamilyChange={(value) => onUpdateField(field.id, { captionFontFamily: value })}
              fontSize={field.captionFontSize}
              onFontSizeChange={(value) => onUpdateField(field.id, { captionFontSize: value })}
              color={field.captionColor}
              onColorChange={(value) => onUpdateField(field.id, { captionColor: value })}
              align={field.captionAlign ?? 'center'}
              onAlignChange={(value) => onUpdateField(field.id, { captionAlign: value })}
              canEdit={canEdit}
            />
          </div>
        </>
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

    case 'draw_on_image':
      return (
        <>
          <p className="settings-field-hint">
            The respondent draws on top of this background image with their finger, mouse, or
            stylus, then submits the annotated result.
          </p>
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

/** The standalone image-upload control for field types whose whole purpose centers on one
 * background/display image (image, draw_on_image) — broken out of ContentExtras into its
 * own "Media" section so it reads as a distinct, visually prominent block rather than
 * being buried among text inputs, matching the redesigned settings-panel layout. Returns
 * null for every other field type (picture_choice's images live per-option inside
 * PictureChoiceOptionsEditor instead, since each option needs its label and image kept
 * together). */
function MediaExtras({
  formId,
  templateId,
  field,
  canEdit,
  onUpdateField,
}: TypeSpecificSettingsProps) {
  if (field.type !== 'image' && field.type !== 'draw_on_image') return null;
  return (
    <FieldImageUpload
      formId={formId}
      templateId={templateId}
      fieldId={field.id}
      imageStorageKey={field.imageStorageKey}
      canEdit={canEdit}
      onUploaded={(storageKey) => onUpdateField(field.id, { imageStorageKey: storageKey })}
      onRemove={() => onUpdateField(field.id, { imageStorageKey: undefined })}
    />
  );
}

/** Everything that belongs in the Validation & behavior group beyond the shared
 * Required toggle / Help text already rendered above it — type-specific constraints.
 * Returns null for field types with no extra validation surface. */
function ValidationExtras({ field, canEdit, onUpdateField }: TypeSpecificSettingsProps) {
  switch (field.type) {
    case 'picture_choice':
      return (
        <label className="settings-toggle-row">
          <span className="settings-label">Randomize option order</span>
          <input
            type="checkbox"
            checked={field.randomizeOrder ?? false}
            disabled={!canEdit}
            onChange={(event) => onUpdateField(field.id, { randomizeOrder: event.target.checked })}
          />
        </label>
      );

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
          <label className="settings-toggle-row">
            <span className="settings-label">Don't embed uploads in the PDF export</span>
            <input
              type="checkbox"
              checked={field.embedInExport === false}
              disabled={!canEdit}
              onChange={(event) =>
                onUpdateField(field.id, {
                  embedInExport: event.target.checked ? false : undefined,
                })
              }
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

  if (field.type === 'draw_on_image') {
    return (
      <>
        <FieldColorPicker
          label="Pen color"
          value={field.strokeColor}
          defaultColor="#1a1a1a"
          canEdit={canEdit}
          onChange={(value) => onUpdateField(field.id, { strokeColor: value })}
        />
        <label className="settings-field">
          <span className="settings-label">Pen thickness</span>
          <input
            className="text-input"
            type="number"
            min={1}
            max={20}
            disabled={!canEdit}
            value={field.strokeWidth ?? 3}
            onChange={(event) =>
              onUpdateField(field.id, { strokeWidth: toOptionalNumber(event.target.value) })
            }
          />
        </label>
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
  /** Exactly one of formId/templateId is expected. Real tenant forms (builder-client.tsx)
   * pass formId; the platform-admin template builder (template-builder-client.tsx) passes
   * templateId instead, since a FormTemplate has no organizationId to scope an image
   * upload under (see buildTemplateFieldImageKey in src/lib/s3.ts). Everything else in
   * this panel is identical between the two contexts. */
  formId?: string;
  templateId?: string;
  schema: FormSchema;
  field: FormField | null;
  canEdit: boolean;
  onUpdateField: (fieldId: string, patch: FieldPatch) => void;
  onReplaceFieldType: (fieldId: string, type: FieldType) => void;
  onSetColumnLayoutColumns: (layoutId: string, columns: ColumnCount) => void;
}

export function FieldSettingsPanel({
  formId,
  templateId,
  schema,
  field,
  canEdit,
  onUpdateField,
  onReplaceFieldType,
  onSetColumnLayoutColumns,
}: FieldSettingsPanelProps) {
  if (!field) {
    return (
      <div className="settings-panel settings-panel--empty">
        <div className="settings-panel-empty-state">
          <p className="settings-panel-empty-title">No field selected</p>
          <p className="settings-panel-empty">
            Click a field on the canvas to edit its label, validation, and appearance.
          </p>
        </div>
      </div>
    );
  }

  const isLayoutOnly = isLayoutOnlyField(field.type);
  const isImage = field.type === 'image';
  const isStaticText = field.type === 'static_text';
  const isSectionBreak = field.type === 'section_break';
  const isDivider = field.type === 'divider';
  const isColumnLayout = field.type === 'column_layout';
  const isHidden = field.type === 'hidden';
  // question_table's required-ness is driven per-row (each question has its own toggle
  // in QuestionTableRowsEditor above) rather than one field-level flag — the generic
  // Required toggle below is skipped for this type so admins aren't shown a control that
  // does nothing (the field-level `required` on this type is unused, per the schema
  // comment on questionTableFieldSchema).
  const isQuestionTable = field.type === 'question_table';
  const isColumnChild = Boolean(findParentColumnLayout(schema, field.id));
  // Structural/layout scaffolding (column_layout itself, section_break, divider) has no
  // "type" a respondent would recognize as data — replaceFieldType() already refuses to
  // touch these as a source (see schema-mutations.ts), so the switcher below just mirrors
  // that boundary rather than showing a dropdown that would silently no-op.
  const canSwitchType = !isSectionBreak && !isDivider && !isColumnLayout;

  const typeSpecificProps: TypeSpecificSettingsProps = {
    formId,
    templateId,
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
  // A separate, always-visible "Media" section for the handful of field types built
  // around one background/display image — see MediaExtras for why picture_choice isn't
  // included here.
  const mediaExtras = MediaExtras(typeSpecificProps);

  // Every real input field, plus section_break, static_text, and image (all three are
  // stylable containers/surfaces even though image and section_break carry no answer),
  // but never a column layout (no surface of its own to color) or a hidden field
  // (nothing rendered).
  const showAppearanceGroup =
    (isSectionBreak || isDivider || isStaticText || isImage || !isLayoutOnly) && !isHidden;

  return (
    <div className="settings-panel" key={field.id}>
      <div className="settings-field settings-field-type-switch">
        <div className="settings-field-type-row">
          <span className="settings-field-type-icon" aria-hidden="true">
            <PaletteIcon type={field.type} />
          </span>
          {canSwitchType ? (
            <select
              className="text-input settings-field-type-select"
              aria-label="Field type"
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
          ) : (
            <select
              className="text-input settings-field-type-select"
              aria-label="Field type"
              value={field.type}
              disabled
            >
              <option value={field.type}>{FIELD_TYPE_LABELS[field.type]}</option>
            </select>
          )}
        </div>
        {isColumnChild ? (
          <span className="settings-field-hint">
            Or drag a field from the palette onto this column cell to change its type.
          </span>
        ) : null}
      </div>

      <div className="settings-section settings-section--flat">
        <p className="settings-section-title">Settings</p>
        {!isStaticText ? (
          <label className="settings-field">
            <span className="settings-label">
              {isSectionBreak || isColumnLayout
                ? 'Header title'
                : isImage || isDivider
                  ? 'Caption (optional)'
                  : isHidden
                    ? 'Internal name'
                    : 'Label'}
            </span>
            <input
              className="text-input"
              value={field.label ?? ''}
              disabled={!canEdit}
              onChange={(event) =>
                onUpdateField(field.id, {
                  label: isDivider ? event.target.value || undefined : event.target.value,
                })
              }
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

        {showBehaviorGroup ? (
          <>
            {!isQuestionTable ? (
              <label className="settings-toggle-row">
                <span className="settings-label">Required</span>
                <input
                  type="checkbox"
                  checked={field.required}
                  disabled={!canEdit}
                  onChange={(event) => onUpdateField(field.id, { required: event.target.checked })}
                />
              </label>
            ) : (
              <p className="settings-field-hint">
                Each question below has its own required toggle instead of one for the whole field.
              </p>
            )}

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
          </>
        ) : null}
      </div>

      {mediaExtras ? (
        <div className="settings-section settings-section--flat">
          <p className="settings-section-title">Media</p>
          {mediaExtras}
        </div>
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
    </div>
  );
}
