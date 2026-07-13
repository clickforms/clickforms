'use client';

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
  IMAGE_SIZE_LABEL,
  IMAGE_SIZE_OPTIONS,
  IMAGE_SPACING_LABEL,
  IMAGE_SPACING_OPTIONS,
  type ImageSize,
  type ImageSpacing,
  isLayoutOnlyField,
  TEXT_ALIGN_LABEL,
  TEXT_ALIGN_OPTIONS,
  TEXT_FONT_SIZE_MAX_PX,
  TEXT_FONT_SIZE_MIN_PX,
  type TextAlign,
} from '@/lib/forms/schema';

interface TypeSpecificSettingsProps {
  formId: string;
  field: FormField;
  canEdit: boolean;
  fields: Record<string, FormField>;
  onUpdateField: (fieldId: string, patch: FieldPatch) => void;
  onSetColumnLayoutColumns: (layoutId: string, columns: ColumnCount) => void;
}

// Chevron used on the "Advanced settings" <summary> — CSS rotates it via the
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

function TypeSpecificSettings({
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
        <div className="settings-section">
          <p className="settings-section-title">Options</p>
          <OptionsEditor
            options={field.options}
            canEdit={canEdit}
            onChange={(options) => onUpdateField(field.id, { options })}
          />
        </div>
      );

    case 'short_text':
    case 'paragraph':
      return (
        <div className="settings-section">
          <p className="settings-section-title">Length limits</p>
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
        </div>
      );

    case 'date':
      return (
        <div className="settings-section">
          <p className="settings-section-title">Date range</p>
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
        </div>
      );

    case 'time':
    case 'email':
    case 'signature':
    case 'address':
      return null;

    case 'choice_matrix':
      return (
        <>
          <div className="settings-section">
            <p className="settings-section-title">Rows</p>
            <OptionsEditor
              options={field.rows}
              canEdit={canEdit}
              onChange={(rows) => onUpdateField(field.id, { rows })}
            />
          </div>
          <div className="settings-section">
            <p className="settings-section-title">Columns (shared ratings)</p>
            <OptionsEditor
              options={field.columns}
              canEdit={canEdit}
              onChange={(columns) => onUpdateField(field.id, { columns })}
            />
          </div>
        </>
      );

    case 'file_upload':
      return (
        <div className="settings-section">
          <p className="settings-section-title">File constraints</p>
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
        </div>
      );

    case 'section_break':
      return null;

    case 'column_layout':
      return (
        <div className="settings-section">
          <p className="settings-section-title">Columns</p>
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
        </div>
      );

    case 'static_text':
      return (
        <div className="settings-section">
          <p className="settings-section-title">Formatted text</p>
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
            <>
              {/* Not a <label> — RichTextEditor's first descendant is a real <button> (Undo),
                  and clicking a <label>'s text forwards a synthetic click to the first labelable
                  control inside it, which would silently fire an undo on click. */}
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
              <div className="settings-section">
                <p className="settings-section-title">Body style</p>
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
            </>
          ) : null}
          <div className="settings-section">
            <p className="settings-section-title">Heading style</p>
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
        </div>
      );

    case 'image':
      return (
        <div className="settings-section">
          <p className="settings-section-title">Image</p>
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
        </div>
      );

    default: {
      const exhaustiveCheck: never = field;
      throw new Error(`Unhandled field type in settings panel: ${JSON.stringify(exhaustiveCheck)}`);
    }
  }
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
  const isColumnChild = Boolean(findParentColumnLayout(schema, field.id));

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

      {!isStaticText && (
        <label className="settings-field">
          <span className="settings-label">
            {isSectionBreak || isColumnLayout
              ? 'Section title'
              : isImage
                ? 'Caption (optional)'
                : 'Label'}
          </span>
          <input
            className="text-input"
            value={field.label}
            disabled={!canEdit}
            onChange={(event) => onUpdateField(field.id, { label: event.target.value })}
          />
        </label>
      )}

      {isSectionBreak ? (
        <label className="settings-field">
          <span className="settings-label">Instruction text (optional)</span>
          <textarea
            className="text-input"
            rows={5}
            placeholder="Important guidance shown below the section heading"
            disabled={!canEdit}
            value={field.helpText ?? ''}
            onChange={(event) =>
              onUpdateField(field.id, { helpText: event.target.value || undefined })
            }
          />
        </label>
      ) : null}

      {!isLayoutOnly && field.type !== 'static_text' && (
        <>
          {!isColumnChild ? (
            <div className="settings-section">
              <p className="settings-section-title">Width</p>
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
            </div>
          ) : null}

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
        </>
      )}

      <TypeSpecificSettings
        formId={formId}
        field={field}
        canEdit={canEdit}
        fields={schema.fields}
        onUpdateField={onUpdateField}
        onSetColumnLayoutColumns={onSetColumnLayoutColumns}
      />

      <ConditionalLogicEditor
        schema={schema}
        field={field}
        canEdit={canEdit}
        onSetRule={onSetConditionalRule}
        onClearRule={() => onClearConditionalRule(field.id)}
      />

      {(isSectionBreak || isStaticText || (!isLayoutOnly && !isImage)) && (
        <details className="settings-advanced">
          <summary className="settings-advanced-summary">
            Advanced settings
            <ChevronIcon className="settings-advanced-chevron" />
          </summary>
          <div className="settings-advanced-content">
            <FieldColorSettings field={field} canEdit={canEdit} onUpdateField={onUpdateField} />
          </div>
        </details>
      )}
    </div>
  );
}
