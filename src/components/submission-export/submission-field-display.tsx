import type { CSSProperties } from 'react';
import type { SubmissionExportAssets } from '@/lib/forms/build-submission-export-assets';
import {
  resolveSubmissionFileDataUrl,
  resolveSubmissionFileName,
} from '@/lib/forms/build-submission-export-assets';
import { parseAddressAnswer, parseChoiceMatrixAnswer } from '@/lib/forms/compound-answer';
import type { FormAnswers } from '@/lib/forms/conditional-logic';
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
import type { ResolvedSubmissionFile } from '@/lib/forms/format-submission-answer';
import { resolveMergeFieldsForRespondent } from '@/lib/forms/merge-fields';
import type { FormField } from '@/lib/forms/schema';
import { formatTimeForDisplay } from '@/lib/forms/time-value';

type FieldValue = string | string[] | undefined;

interface SubmissionFieldDisplayProps {
  field: FormField;
  value: FieldValue;
  allFields: Record<string, FormField>;
  answers: FormAnswers;
  assets: SubmissionExportAssets;
  resolveFiles: (fieldId: string) => ResolvedSubmissionFile[];
  /** Set by the column-layout renderer for its child fields — see the matching prop on
   * FieldInput (app/f/[slug]/field-input.tsx) for why the option grid is skipped inside a
   * narrow column cell. */
  disableOptionGrid?: boolean;
}

function formatDateValue(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' });
}

function OptionIndicator({ kind, selected }: { kind: 'radio' | 'checkbox'; selected: boolean }) {
  return (
    <span
      className={`export-option-indicator export-option-indicator--${kind} ${selected ? 'is-selected' : ''}`}
      aria-hidden="true"
    >
      {selected ? (kind === 'checkbox' ? '✓' : '●') : ''}
    </span>
  );
}

export function SubmissionFieldDisplay({
  field,
  value,
  allFields,
  answers,
  assets,
  resolveFiles,
  disableOptionGrid,
}: SubmissionFieldDisplayProps) {
  if (field.type === 'section_break') {
    return (
      <div className="export-section-break-wrap">
        <div className="export-section-break" style={resolveSectionBreakStyle(field)}>
          <h3 className="export-section-break-title">{field.label}</h3>
        </div>
        {field.helpText ? <p className="export-section-instruction">{field.helpText}</p> : null}
      </div>
    );
  }

  if (field.type === 'image') {
    const src = assets.fieldImages[field.id];
    if (!src) return null;
    return (
      <div className="export-image-field" style={resolveImageSpacingStyle(field)}>
        {field.label ? <p className="export-image-caption">{field.label}</p> : null}
        {/* biome-ignore lint/performance/noImgElement: dynamic/presigned image URLs; next/image is a poor fit here */}
        <img src={src} alt={field.alt ?? field.label} style={resolveImageStyle(field)} />
      </div>
    );
  }

  if (field.type === 'static_text') {
    const containerStyle = resolveFieldContainerStyle(field);
    const html = resolveMergeFieldsForRespondent(field.body, allFields, answers);
    return (
      <div
        className={`export-static-text ${fieldHasCustomAppearance(field) ? 'export-static-text--colored' : ''}`}
        style={Object.keys(containerStyle).length > 0 ? containerStyle : undefined}
      >
        {field.label ? (
          <p className="export-static-text-heading" style={resolveStaticTextHeadingStyle(field)}>
            {field.label}
          </p>
        ) : null}
        {field.showBody !== false ? (
          <div
            className="export-static-text-body"
            style={resolveStaticTextBodyStyle(field)}
            // biome-ignore lint/security/noDangerouslySetInnerHtml: admin-authored rich text, see note in field-input.tsx
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
      className={`export-field-group ${fieldHasCustomAppearance(field) ? 'export-field-group--highlighted' : ''}`}
      style={Object.keys(containerStyle).length > 0 ? containerStyle : undefined}
    >
      <div className="export-field-label">
        {field.label}
        {field.required ? ' *' : ''}
      </div>
      {field.helpText ? <p className="export-field-help">{field.helpText}</p> : null}

      {field.type === 'short_text' || field.type === 'email' ? (
        <input
          className="export-input"
          style={inputStyle}
          readOnly
          value={typeof value === 'string' ? value : ''}
        />
      ) : null}

      {field.type === 'paragraph' ? (
        <div className="export-textarea export-input" style={inputStyle}>
          {typeof value === 'string' ? value : ''}
        </div>
      ) : null}

      {field.type === 'date' ? (
        <input
          className="export-input"
          style={inputStyle}
          readOnly
          value={typeof value === 'string' && value ? formatDateValue(value) : ''}
        />
      ) : null}

      {field.type === 'time' ? (
        <input
          className="export-input"
          style={inputStyle}
          readOnly
          value={typeof value === 'string' && value ? formatTimeForDisplay(value) || value : ''}
        />
      ) : null}

      {field.type === 'dropdown' ? (
        <input
          className="export-input"
          style={inputStyle}
          readOnly
          value={
            typeof value === 'string' && value
              ? (field.options.find((option) => option.id === value)?.label ?? value)
              : ''
          }
        />
      ) : null}

      {field.type === 'multi_choice' ? (
        <div
          className={`export-option-list ${useOptionGrid ? 'export-option-list--grid' : ''}`}
          style={inputStyle}
        >
          {field.options.map((option) => (
            <div key={option.id} className="export-option-row">
              <OptionIndicator kind="radio" selected={value === option.id} />
              <span>{option.label}</span>
            </div>
          ))}
        </div>
      ) : null}

      {field.type === 'checkbox' ? (
        <div
          className={`export-option-list ${useOptionGrid ? 'export-option-list--grid' : ''}`}
          style={inputStyle}
        >
          {field.options.map((option) => {
            const selected = Array.isArray(value) && value.includes(option.id);
            return (
              <div key={option.id} className="export-option-row">
                <OptionIndicator kind="checkbox" selected={selected} />
                <span>{option.label}</span>
              </div>
            );
          })}
        </div>
      ) : null}

      {field.type === 'file_upload' ? (
        <FileExportDisplay fieldId={field.id} assets={assets} resolveFiles={resolveFiles} />
      ) : null}

      {field.type === 'signature' ? (
        <SignatureExportDisplay fieldId={field.id} assets={assets} resolveFiles={resolveFiles} />
      ) : null}

      {field.type === 'address' ? (
        <AddressExportDisplay value={value} inputStyle={inputStyle} />
      ) : null}

      {field.type === 'choice_matrix' ? (
        <ChoiceMatrixExportDisplay field={field} value={value} />
      ) : null}
    </div>
  );
}

function FileExportDisplay({
  fieldId,
  assets,
  resolveFiles,
}: {
  fieldId: string;
  assets: SubmissionExportAssets;
  resolveFiles: (fieldId: string) => ResolvedSubmissionFile[];
}) {
  const imageUrl = resolveSubmissionFileDataUrl(assets, fieldId, resolveFiles);
  const filename = resolveSubmissionFileName(fieldId, resolveFiles);
  if (imageUrl) {
    return (
      <div className="export-signature">
        {/* biome-ignore lint/performance/noImgElement: dynamic/presigned image URLs; next/image is a poor fit here */}
        <img src={imageUrl} alt={filename ?? 'Uploaded file'} />
      </div>
    );
  }
  if (!filename) return <div className="export-file-status">No file uploaded</div>;
  return <div className="export-file-status">{filename}</div>;
}

function SignatureExportDisplay({
  fieldId,
  assets,
  resolveFiles,
}: {
  fieldId: string;
  assets: SubmissionExportAssets;
  resolveFiles: (fieldId: string) => ResolvedSubmissionFile[];
}) {
  const imageUrl = resolveSubmissionFileDataUrl(assets, fieldId, resolveFiles);
  if (!imageUrl) return <div className="export-file-status">No signature</div>;
  return (
    <div className="export-signature">
      {/* biome-ignore lint/performance/noImgElement: dynamic/presigned image URLs; next/image is a poor fit here */}
      <img src={imageUrl} alt="Signature" />
    </div>
  );
}

function AddressExportDisplay({
  value,
  inputStyle,
}: {
  value: FieldValue;
  inputStyle: CSSProperties;
}) {
  const address = parseAddressAnswer(typeof value === 'string' ? value : undefined);
  return (
    <div className="export-address-field">
      <input
        className="export-input"
        style={inputStyle}
        readOnly
        value={address.street}
        placeholder="Street address"
      />
      <div className="export-address-row">
        <input
          className="export-input"
          style={inputStyle}
          readOnly
          value={address.suburb}
          placeholder="Suburb"
        />
        <input
          className="export-input"
          style={inputStyle}
          readOnly
          value={address.state}
          placeholder="State"
        />
        <input
          className="export-input"
          style={inputStyle}
          readOnly
          value={address.postcode}
          placeholder="Postcode"
        />
      </div>
    </div>
  );
}

function ChoiceMatrixExportDisplay({
  field,
  value,
}: {
  field: Extract<FormField, { type: 'choice_matrix' }>;
  value: FieldValue;
}) {
  const answer = parseChoiceMatrixAnswer(typeof value === 'string' ? value : undefined);
  return (
    <div className="export-choice-matrix-wrap">
      <table className="export-choice-matrix">
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
              <td className="export-choice-matrix-row-label">{row.label}</td>
              {field.columns.map((column) => (
                <td key={column.id}>
                  <OptionIndicator kind="radio" selected={answer[row.id] === column.id} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function submissionFieldWidthClass(field: FormField): string {
  return `field-width--${resolveFieldWidth(field)}`;
}
