'use client';

import type { ChangeEvent } from 'react';
import { useState } from 'react';
import { SignaturePad } from '@/app/f/[slug]/signature-pad';
import { DatePickerField } from '@/components/date-picker/date-picker-field';
import { TimePickerField } from '@/components/time-picker/time-picker-field';
import {
  parseAddressAnswer,
  parseChoiceMatrixAnswer,
  serializeAddressAnswer,
  serializeChoiceMatrixAnswer,
} from '@/lib/forms/compound-answer';
import type { FormAnswers } from '@/lib/forms/conditional-logic';
import { getFieldImageSrc } from '@/lib/forms/field-image';
import {
  fieldHasCustomAppearance,
  resolveFieldContainerStyle,
  resolveFieldInputStyle,
  resolveImageSpacingStyle,
  resolveImageStyle,
  resolveSectionBreakStyle,
  resolveStaticTextBodyStyle,
  resolveStaticTextHeadingStyle,
} from '@/lib/forms/field-styles';
import { resolveFieldWidth } from '@/lib/forms/field-width';
import { resolveMergeFieldsForRespondent } from '@/lib/forms/merge-fields';
import type { FormField } from '@/lib/forms/schema';

// Renders a single field's input control, switching on FormField's discriminant. Owns no
// answer state itself (the wizard in form-renderer-client.tsx is the single source of
// truth for `answers`) except for the transient "is this file/signature currently
// uploading" state, which is local and per-field since it has no bearing on form
// progress/validation — only the resulting fileId (written via onChange) does.

export type FieldValue = string | string[] | undefined;

interface FieldInputProps {
  slug?: string;
  /** Set alongside previewMode so image fields can resolve against the draft version
   * instead of the slug-based route, which 404s on an unpublished form (see
   * lib/forms/field-image.ts). */
  formId?: string;
  previewMode?: boolean;
  field: FormField;
  value: FieldValue;
  error?: string;
  onChange: (value: FieldValue) => void;
  /** Required for file_upload/signature fields — runs the presign/PUT/confirm flow and
   * resolves with the resulting SubmissionFile id. */
  onUploadFile?: (fieldId: string, file: File) => Promise<string>;
  /** Only needed for static_text fields — lets its merge-field tokens resolve against the
   * respondent's answers so far (see lib/forms/merge-fields.ts). Optional because every
   * other field type ignores it. */
  allFields?: Record<string, FormField>;
  answers?: FormAnswers;
  /** Set by the column-layout renderer for its child fields — a multi_choice/checkbox
   * option list would otherwise switch to a multi-column grid once it has 4+ options
   * (see useOptionGrid below), which only makes sense at full page width. Inside a
   * narrow column cell that grid squeezes into cramped, wrapped sub-columns, so column
   * children always render their options as a single vertical list instead. */
  disableOptionGrid?: boolean;
}

export function FieldInput({
  slug,
  formId,
  previewMode,
  field,
  value,
  error,
  onChange,
  onUploadFile,
  allFields,
  answers,
  disableOptionGrid,
}: FieldInputProps) {
  if (field.type === 'section_break') {
    // The colored banner (.form-section-break) is just the label — helpText renders
    // as a plain paragraph below it, not inside the colored bar, matching the
    // reference incident-report layout (banner is a pure section title, the
    // "IMPORTANT: ..." instructional text underneath it is normal body copy).
    return (
      <div className="form-section-break-wrap">
        <div className="form-section-break" style={resolveSectionBreakStyle(field)}>
          <h3 className="form-section-break-title">{field.label}</h3>
        </div>
        {field.helpText ? <p className="form-section-instruction">{field.helpText}</p> : null}
      </div>
    );
  }

  if (field.type === 'image') {
    if (!field.imageStorageKey || !slug) {
      return null;
    }
    const src = getFieldImageSrc({ slug, formId, fieldId: field.id, preferFormId: previewMode });
    if (!src) return null;
    return (
      <div className="form-image-field" style={resolveImageSpacingStyle(field)}>
        {field.label ? <p className="form-image-field-caption">{field.label}</p> : null}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={field.alt ?? field.label}
          className="form-image-field-img"
          style={resolveImageStyle(field)}
        />
      </div>
    );
  }

  if (field.type === 'static_text') {
    const containerStyle = resolveFieldContainerStyle(field);
    const html = resolveMergeFieldsForRespondent(field.body, allFields ?? {}, answers ?? {});
    return (
      <div
        className={`form-static-text ${fieldHasCustomAppearance(field) ? 'form-static-text--colored' : ''}`}
        style={Object.keys(containerStyle).length > 0 ? containerStyle : undefined}
      >
        {field.label ? (
          <p className="form-static-text-heading" style={resolveStaticTextHeadingStyle(field)}>
            {field.label}
          </p>
        ) : null}
        {/* Body is admin-authored rich text from RichTextEditor (builder/rich-text-editor.tsx),
            not respondent input, so rendering it as HTML here isn't an XSS vector — the only
            untrusted data spliced in is the merge-field substitution above, which
            resolveMergeFieldsForRespondent already HTML-escapes. showBody === false skips this
            block entirely (not just an empty body) so a heading-only field carries no extra
            line-height/margin from an empty rich-text container. */}
        {field.showBody !== false ? (
          <div
            className="form-static-text-body"
            style={resolveStaticTextBodyStyle(field)}
            // biome-ignore lint/security/noDangerouslySetInnerHtml: admin-authored rich text, untrusted parts are pre-escaped (see comment above)
            dangerouslySetInnerHTML={{ __html: html }}
          />
        ) : null}
      </div>
    );
  }

  const containerStyle = resolveFieldContainerStyle(field);
  const inputStyle = resolveFieldInputStyle(field);
  const fieldWidth = resolveFieldWidth(field);
  const useOptionGrid =
    !disableOptionGrid &&
    (field.type === 'multi_choice' || field.type === 'checkbox') &&
    field.options.length >= 4 &&
    fieldWidth === 'full';

  return (
    <div
      className={`form-field-group ${fieldHasCustomAppearance(field) ? 'form-field-group--highlighted' : ''}`}
      style={Object.keys(containerStyle).length > 0 ? containerStyle : undefined}
    >
      <label className="form-field-label" htmlFor={field.id}>
        {field.label}
        {field.required ? <span className="form-field-required">*</span> : null}
      </label>
      {field.helpText ? <p className="form-field-help">{field.helpText}</p> : null}

      {field.type === 'short_text' ? (
        <input
          id={field.id}
          type="text"
          className="text-input form-field-input"
          style={inputStyle}
          value={typeof value === 'string' ? value : ''}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : null}

      {field.type === 'paragraph' ? (
        <textarea
          id={field.id}
          className="text-input form-field-input"
          rows={4}
          style={inputStyle}
          value={typeof value === 'string' ? value : ''}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : null}

      {field.type === 'multi_choice' ? (
        <div
          className={`form-option-list ${useOptionGrid ? 'form-option-list--grid' : ''}`}
          style={inputStyle}
          role="radiogroup"
          aria-label={field.label}
        >
          {field.options.map((option) => (
            <label key={option.id} className="form-option-row">
              <input
                type="radio"
                name={field.id}
                value={option.id}
                checked={value === option.id}
                onChange={() => onChange(option.id)}
              />
              {option.label}
            </label>
          ))}
        </div>
      ) : null}

      {field.type === 'checkbox' ? (
        <div
          className={`form-option-list ${useOptionGrid ? 'form-option-list--grid' : ''}`}
          style={inputStyle}
        >
          {field.options.map((option) => {
            const selected = Array.isArray(value) && value.includes(option.id);
            return (
              <label key={option.id} className="form-option-row">
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={() => {
                    const current = Array.isArray(value) ? value : [];
                    onChange(
                      selected ? current.filter((v) => v !== option.id) : [...current, option.id],
                    );
                  }}
                />
                {option.label}
              </label>
            );
          })}
        </div>
      ) : null}

      {field.type === 'dropdown' ? (
        <select
          id={field.id}
          className="text-input form-field-input"
          style={inputStyle}
          value={typeof value === 'string' ? value : ''}
          onChange={(event) => onChange(event.target.value)}
        >
          <option value="">Select…</option>
          {field.options.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      ) : null}

      {field.type === 'date' ? (
        <DatePickerField
          id={field.id}
          className="text-input form-field-input"
          style={inputStyle}
          value={typeof value === 'string' ? value : ''}
          min={field.validation?.minDate}
          max={field.validation?.maxDate}
          onChange={(nextValue) => onChange(nextValue)}
        />
      ) : null}

      {field.type === 'time' ? (
        <TimePickerField
          id={field.id}
          className="text-input form-field-input"
          style={inputStyle}
          value={typeof value === 'string' ? value : ''}
          onChange={(nextValue) => onChange(nextValue || undefined)}
        />
      ) : null}

      {field.type === 'email' ? (
        <input
          id={field.id}
          type="email"
          className="text-input form-field-input"
          style={inputStyle}
          autoComplete="email"
          value={typeof value === 'string' ? value : ''}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : null}

      {field.type === 'file_upload' ? (
        <FileUploadControl
          field={field}
          value={value}
          onChange={onChange}
          onUploadFile={onUploadFile}
        />
      ) : null}

      {field.type === 'signature' ? (
        <SignatureControl
          field={field}
          value={value}
          onChange={onChange}
          onUploadFile={onUploadFile}
        />
      ) : null}

      {field.type === 'address' ? <AddressControl value={value} onChange={onChange} /> : null}

      {field.type === 'choice_matrix' ? (
        <ChoiceMatrixControl field={field} value={value} onChange={onChange} />
      ) : null}

      {error ? <p className="form-field-error">{error}</p> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// file_upload — a plain <input type="file"> that immediately kicks off the
// presign/PUT/confirm flow on selection. v1 is single-file-per-field, so the answer is
// just the resulting fileId string, not an array.
// ---------------------------------------------------------------------------

interface FileUploadControlProps {
  field: Extract<FormField, { type: 'file_upload' }>;
  value: FieldValue;
  onChange: (value: FieldValue) => void;
  onUploadFile?: (fieldId: string, file: File) => Promise<string>;
}

function FileUploadControl({ field, value, onChange, onUploadFile }: FileUploadControlProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const currentFileId = typeof value === 'string' ? value : undefined;
  const accept = field.validation?.acceptedTypes?.join(',');

  async function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Reset immediately so picking the same file again after a "Remove" still fires onChange.
    event.target.value = '';
    if (!file || !onUploadFile) return;

    setUploading(true);
    setUploadError(null);
    try {
      const fileId = await onUploadFile(field.id, file);
      setFileName(file.name);
      onChange(fileId);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  }

  function handleRemove() {
    setFileName(null);
    setUploadError(null);
    onChange(undefined);
  }

  return (
    <div className="form-field-file">
      {currentFileId && !uploading ? (
        <div className="form-field-file-status">
          <span>{fileName ?? 'File uploaded'} ✓</span>
          <button
            type="button"
            className="button button--ghost button--small"
            onClick={handleRemove}
          >
            Remove
          </button>
        </div>
      ) : (
        <input
          id={field.id}
          type="file"
          className="form-field-file-input"
          accept={accept}
          disabled={uploading}
          onChange={handleChange}
        />
      )}
      {uploading ? <p className="form-field-help">Uploading…</p> : null}
      {uploadError ? <p className="form-field-error">{uploadError}</p> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// signature — embeds SignaturePad; once the drawn PNG is uploaded the answer is the
// resulting fileId, same shape as file_upload.
// ---------------------------------------------------------------------------

interface SignatureControlProps {
  field: Extract<FormField, { type: 'signature' }>;
  value: FieldValue;
  onChange: (value: FieldValue) => void;
  onUploadFile?: (fieldId: string, file: File) => Promise<string>;
}

function SignatureControl({ field, value, onChange, onUploadFile }: SignatureControlProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const currentFileId = typeof value === 'string' ? value : undefined;

  async function handleSave(blob: Blob) {
    if (!onUploadFile) return;
    setUploading(true);
    setUploadError(null);
    try {
      const file = new File([blob], 'signature.png', { type: 'image/png' });
      const fileId = await onUploadFile(field.id, file);
      onChange(fileId);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  }

  if (currentFileId) {
    return (
      <div className="signature-pad-signed">
        <span>Signed ✓</span>
        <button
          type="button"
          className="button button--ghost button--small"
          onClick={() => {
            setUploadError(null);
            onChange(undefined);
          }}
        >
          Clear and re-sign
        </button>
      </div>
    );
  }

  return (
    <div>
      <SignaturePad onSave={handleSave} saving={uploading} />
      {uploadError ? <p className="form-field-error">{uploadError}</p> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// address — four sub-inputs (street/suburb/state/postcode); the answer stored in
// `value` is a single JSON string (see lib/forms/compound-answer.ts) so it fits the
// same `string | string[] | undefined` slot every other field type uses.
// ---------------------------------------------------------------------------

interface AddressControlProps {
  value: FieldValue;
  onChange: (value: FieldValue) => void;
}

function AddressControl({ value, onChange }: AddressControlProps) {
  const address = parseAddressAnswer(value);

  function update(partial: Partial<typeof address>) {
    onChange(serializeAddressAnswer({ ...address, ...partial }));
  }

  return (
    <div className="form-address-field">
      <input
        type="text"
        className="text-input form-field-input"
        placeholder="Street address"
        value={address.street}
        onChange={(event) => update({ street: event.target.value })}
      />
      <div className="form-address-field-row">
        <input
          type="text"
          className="text-input form-field-input"
          placeholder="Suburb"
          value={address.suburb}
          onChange={(event) => update({ suburb: event.target.value })}
        />
        <input
          type="text"
          className="text-input form-field-input"
          placeholder="State"
          value={address.state}
          onChange={(event) => update({ state: event.target.value })}
        />
        <input
          type="text"
          className="text-input form-field-input"
          placeholder="Postcode"
          value={address.postcode}
          onChange={(event) => update({ postcode: event.target.value })}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// choice_matrix — a ratings grid: one radio group per row, sharing the same set of
// columns. The answer is a single JSON string mapping rowId -> columnId.
// ---------------------------------------------------------------------------

interface ChoiceMatrixControlProps {
  field: Extract<FormField, { type: 'choice_matrix' }>;
  value: FieldValue;
  onChange: (value: FieldValue) => void;
}

function ChoiceMatrixControl({ field, value, onChange }: ChoiceMatrixControlProps) {
  const answer = parseChoiceMatrixAnswer(value);

  function selectCell(rowId: string, columnId: string) {
    onChange(serializeChoiceMatrixAnswer({ ...answer, [rowId]: columnId }));
  }

  return (
    <div className="form-choice-matrix-wrap">
      <table className="form-choice-matrix">
        <thead>
          <tr>
            <th />
            {field.columns.map((column) => (
              <th key={column.id}>{column.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {field.rows.map((row) => (
            <tr key={row.id}>
              <td className="form-choice-matrix-row-label">{row.label}</td>
              {field.columns.map((column) => (
                <td key={column.id}>
                  <input
                    type="radio"
                    name={`${field.id}-${row.id}`}
                    checked={answer[row.id] === column.id}
                    onChange={() => selectCell(row.id, column.id)}
                    aria-label={`${row.label}: ${column.label}`}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
