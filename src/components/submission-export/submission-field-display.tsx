import type { CSSProperties } from 'react';
import { formatCalculationResult } from '@/lib/forms/calculation';
import {
  isTableRowBlank,
  parseAddressAnswer,
  parseChoiceMatrixAnswer,
  parseFullNameAnswer,
  parseQuestionTableAnswer,
  parseTableAnswer,
} from '@/lib/forms/compound-answer';
import type { FormAnswers } from '@/lib/forms/conditional-logic';
import {
  fieldHasCustomAppearance,
  resolveDividerCaptionStyle,
  resolveDividerLineStyle,
  resolveDividerWrapStyle,
  resolveFieldContainerStyle,
  resolveFieldInputStyle,
  resolveImageSpacingStyle,
  resolveImageStyle,
  resolveQuestionTableLabelStyle,
  resolveSectionBreakStyle,
  resolveStaticTextBodyStyle,
  resolveStaticTextHeadingStyle,
} from '@/lib/forms/field-styles';
import { resolveFieldWidth } from '@/lib/forms/field-width';
import type { ResolvedSubmissionFile } from '@/lib/forms/format-submission-answer';
import { resolveMergeFieldsForRespondent } from '@/lib/forms/merge-fields';
import type { FormField } from '@/lib/forms/schema';
import type { SubmissionExportAssets } from '@/lib/forms/submission-export-assets';
import { resolveSubmissionFileDataUrl } from '@/lib/forms/submission-export-assets';
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

  if (field.type === 'divider') {
    const captionEl = field.label ? (
      <span className="export-divider-caption" style={resolveDividerCaptionStyle(field)}>
        {field.label}
      </span>
    ) : null;
    return (
      <div className="export-divider-wrap">
        <div className="export-divider-box" style={resolveDividerWrapStyle(field)}>
          {(field.captionPosition ?? 'above') === 'above' ? captionEl : null}
          <div className="export-divider-line" style={resolveDividerLineStyle(field)} />
          {field.captionPosition === 'below' ? captionEl : null}
        </div>
      </div>
    );
  }

  if (field.type === 'image') {
    const src = assets.fieldImages[field.id];
    if (!src) return null;
    const align = field.align ?? 'center';
    return (
      <div
        className={`export-image-field export-image-field--align-${align}`}
        style={resolveImageSpacingStyle(field)}
      >
        {field.label ? <p className="export-image-caption">{field.label}</p> : null}
        {/* biome-ignore lint/performance/noImgElement: dynamic/presigned image URLs; next/image is a poor fit here */}
        <img src={src} alt={field.alt ?? field.label} style={resolveImageStyle(field)} />
      </div>
    );
  }

  if (field.type === 'hidden') {
    // Not on the live public form, but still shown in the export/admin view so the
    // captured value (tracking id, referral source, etc.) is actually reviewable —
    // see the schema comment on hiddenFieldSchema for the full rationale.
    if (typeof value !== 'string' || !value) return null;
    return (
      <div className="export-field-group">
        <div className="export-field-label">{field.label} (hidden field)</div>
        <input className="export-input" readOnly value={value} />
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
      <div
        className="export-field-label"
        style={field.type === 'question_table' ? resolveQuestionTableLabelStyle(field) : undefined}
      >
        {field.label}
        {field.required ? ' *' : ''}
      </div>
      {field.helpText ? <p className="export-field-help">{field.helpText}</p> : null}

      {field.type === 'short_text' ||
      field.type === 'email' ||
      field.type === 'phone' ||
      field.type === 'masked_text' ? (
        <input
          className="export-input"
          style={inputStyle}
          readOnly
          value={typeof value === 'string' ? value : ''}
        />
      ) : null}

      {field.type === 'website' ? (
        <input
          className="export-input"
          style={inputStyle}
          readOnly
          value={typeof value === 'string' ? value : ''}
        />
      ) : null}

      {field.type === 'number' ? (
        <input
          className="export-input"
          style={inputStyle}
          readOnly
          value={
            typeof value === 'string' && value
              ? [field.prefix, value, field.suffix].filter(Boolean).join('')
              : ''
          }
        />
      ) : null}

      {field.type === 'calculation' ? (
        <input
          className="export-input"
          style={inputStyle}
          readOnly
          value={
            typeof value === 'string' && value && !Number.isNaN(Number(value))
              ? formatCalculationResult(Number(value), {
                  decimalPlaces: field.decimalPlaces,
                  prefix: field.prefix,
                  suffix: field.suffix,
                })
              : ''
          }
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
          // A value that doesn't match any real option id is a respondent-typed "Other"
          // answer (see OTHER_OPTION_ID in field-input.tsx) — shown as-is rather than
          // falling back to the raw sentinel/id, since that free text *is* the answer.
          value={
            typeof value === 'string'
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
          {field.allowOther &&
          typeof value === 'string' &&
          value.length > 0 &&
          !field.options.some((option) => option.id === value) ? (
            <div className="export-option-row">
              <OptionIndicator kind="radio" selected />
              <span>Other: {value}</span>
            </div>
          ) : null}
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
          {field.allowOther && Array.isArray(value)
            ? (() => {
                const otherEntry = value.find(
                  (entry) => !field.options.some((option) => option.id === entry),
                );
                return otherEntry !== undefined ? (
                  <div className="export-option-row">
                    <OptionIndicator kind="checkbox" selected />
                    <span>Other: {otherEntry}</span>
                  </div>
                ) : null;
              })()
            : null}
        </div>
      ) : null}

      {field.type === 'file_upload' ? (
        <FileExportDisplay fieldId={field.id} assets={assets} resolveFiles={resolveFiles} />
      ) : null}

      {field.type === 'signature' ? (
        <SignatureExportDisplay fieldId={field.id} assets={assets} resolveFiles={resolveFiles} />
      ) : null}

      {field.type === 'draw_on_image' ? (
        <DrawOnImageExportDisplay fieldId={field.id} assets={assets} resolveFiles={resolveFiles} />
      ) : null}

      {field.type === 'address' ? (
        <AddressExportDisplay
          value={value}
          inputStyle={inputStyle}
          includeCountry={field.includeCountry ?? false}
        />
      ) : null}

      {field.type === 'full_name' ? (
        <FullNameExportDisplay
          value={value}
          inputStyle={inputStyle}
          includePrefix={field.includePrefix ?? false}
          includeMiddleName={field.includeMiddleName ?? false}
        />
      ) : null}

      {field.type === 'choice_matrix' ? (
        <ChoiceMatrixExportDisplay field={field} value={value} />
      ) : null}

      {field.type === 'table' ? <TableExportDisplay field={field} value={value} /> : null}

      {field.type === 'question_table' ? (
        <QuestionTableExportDisplay field={field} value={value} />
      ) : null}

      {field.type === 'rating' ? <RatingExportDisplay field={field} value={value} /> : null}

      {field.type === 'opinion_scale' ? (
        <OpinionScaleExportDisplay field={field} value={value} />
      ) : null}

      {field.type === 'legal' ? <LegalExportDisplay field={field} value={value} /> : null}

      {field.type === 'yes_no' ? <YesNoExportDisplay field={field} value={value} /> : null}

      {field.type === 'ranking' ? <RankingExportDisplay field={field} value={value} /> : null}

      {field.type === 'picture_choice' ? (
        <PictureChoiceExportDisplay field={field} value={value} />
      ) : null}
    </div>
  );
}

const RATING_EXPORT_GLYPHS: Record<string, [string, string]> = {
  star: ['★', '☆'],
  heart: ['♥', '♡'],
  thumb: ['👍', '👍'],
};

function RatingExportDisplay({
  field,
  value,
}: {
  field: Extract<FormField, { type: 'rating' }>;
  value: FieldValue;
}) {
  const max = field.maxRating ?? 5;
  const selected = typeof value === 'string' ? Number(value) : 0;
  const [filledGlyph, emptyGlyph] = RATING_EXPORT_GLYPHS[field.icon ?? 'star'] ?? ['★', '☆'];
  return (
    <div
      className="export-rating"
      style={field.color ? ({ '--export-rating-color': field.color } as CSSProperties) : undefined}
    >
      {Array.from({ length: max }, (_, index) => index + 1).map((star) => (
        <span key={star} className={star <= selected ? 'export-rating-star--filled' : ''}>
          {star <= selected ? filledGlyph : emptyGlyph}
        </span>
      ))}
    </div>
  );
}

function OpinionScaleExportDisplay({
  field,
  value,
}: {
  field: Extract<FormField, { type: 'opinion_scale' }>;
  value: FieldValue;
}) {
  const min = field.scaleMin ?? 0;
  const max = field.scaleMax ?? 10;
  return (
    <div className="export-input">
      {typeof value === 'string' && value ? `${value} (${min}–${max} scale)` : ''}
    </div>
  );
}

function LegalExportDisplay({
  value,
}: {
  field: Extract<FormField, { type: 'legal' }>;
  value: FieldValue;
}) {
  return <div className="export-input">{value === 'true' ? '✓ Agreed' : 'Not agreed'}</div>;
}

function YesNoExportDisplay({
  field,
  value,
}: {
  field: Extract<FormField, { type: 'yes_no' }>;
  value: FieldValue;
}) {
  if (value !== 'yes' && value !== 'no') {
    return <div className="export-input">—</div>;
  }
  return (
    <div className="export-input">
      {value === 'yes' ? field.yesLabel || 'Yes' : field.noLabel || 'No'}
    </div>
  );
}

function FileExportDisplay({
  fieldId,
  resolveFiles,
}: {
  fieldId: string;
  assets: SubmissionExportAssets;
  resolveFiles: (fieldId: string) => ResolvedSubmissionFile[];
}) {
  // Lists every resolved file for this field, not just the first — a `multiple`-enabled
  // file_upload field can have several SubmissionFile rows sharing this fieldId (see the
  // schema comment on fileUploadFieldSchema.multiple for why that required no DB change).
  // Images are no longer rendered inline here: when embedInExport !== false they're
  // rendered instead in a trailing "Attachments" section (see
  // SubmissionFormExportDocument) so they always land on the last page rather than
  // disrupting the form's layout at this field's position. Whether or not a field embeds,
  // the filename is still listed here so the export makes clear something was uploaded.
  const files = resolveFiles(fieldId);
  if (files.length === 0) return <div className="export-file-status">No file uploaded</div>;
  return (
    <div className="export-file-list">
      {files.map((file) => (
        <div key={file.id} className="export-file-status">
          {file.filename}
        </div>
      ))}
    </div>
  );
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

function DrawOnImageExportDisplay({
  fieldId,
  assets,
  resolveFiles,
}: {
  fieldId: string;
  assets: SubmissionExportAssets;
  resolveFiles: (fieldId: string) => ResolvedSubmissionFile[];
}) {
  const imageUrl = resolveSubmissionFileDataUrl(assets, fieldId, resolveFiles);
  if (!imageUrl) return <div className="export-file-status">No drawing submitted</div>;
  return (
    <div className="export-signature export-drawing">
      {/* biome-ignore lint/performance/noImgElement: dynamic/presigned image URLs; next/image is a poor fit here */}
      <img src={imageUrl} alt="Drawing" />
    </div>
  );
}

function AddressExportDisplay({
  value,
  inputStyle,
  includeCountry,
}: {
  value: FieldValue;
  inputStyle: CSSProperties;
  includeCountry: boolean;
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
      {includeCountry ? (
        <input
          className="export-input"
          style={inputStyle}
          readOnly
          value={address.country}
          placeholder="Country"
        />
      ) : null}
    </div>
  );
}

function FullNameExportDisplay({
  value,
  inputStyle,
  includePrefix,
  includeMiddleName,
}: {
  value: FieldValue;
  inputStyle: CSSProperties;
  includePrefix: boolean;
  includeMiddleName: boolean;
}) {
  const name = parseFullNameAnswer(typeof value === 'string' ? value : undefined);
  return (
    <div className="export-full-name-row">
      {includePrefix ? (
        <input
          className="export-input export-full-name-prefix"
          style={inputStyle}
          readOnly
          value={name.prefix}
          placeholder="Prefix"
        />
      ) : null}
      <input
        className="export-input"
        style={inputStyle}
        readOnly
        value={name.first}
        placeholder="First name"
      />
      {includeMiddleName ? (
        <input
          className="export-input"
          style={inputStyle}
          readOnly
          value={name.middle}
          placeholder="Middle name"
        />
      ) : null}
      <input
        className="export-input"
        style={inputStyle}
        readOnly
        value={name.last}
        placeholder="Last name"
      />
    </div>
  );
}

function RankingExportDisplay({
  field,
  value,
}: {
  field: Extract<FormField, { type: 'ranking' }>;
  value: FieldValue;
}) {
  const labelById = new Map(field.options.map((option) => [option.id, option.label]));
  // Falls back to the admin-authored option order when there's no saved answer yet
  // (e.g. previewing a form that's never been submitted) — same fallback RankingControl
  // uses on the public form.
  const orderedIds =
    Array.isArray(value) && value.length > 0 ? value : field.options.map((o) => o.id);
  return (
    <ol className="export-ranking-list">
      {orderedIds.map((id) => (
        <li key={id}>{labelById.get(id) ?? id}</li>
      ))}
    </ol>
  );
}

function PictureChoiceExportDisplay({
  field,
  value,
}: {
  field: Extract<FormField, { type: 'picture_choice' }>;
  value: FieldValue;
}) {
  const selected =
    typeof value === 'string' ? field.options.find((o) => o.id === value) : undefined;
  if (!selected) {
    return <div className="export-input">—</div>;
  }
  return (
    <div className="export-picture-choice">
      {selected.imageUrl ? (
        // biome-ignore lint/performance/noImgElement: admin-supplied arbitrary URL
        <img src={selected.imageUrl} alt={selected.label} className="export-picture-choice-image" />
      ) : null}
      <span>{selected.label}</span>
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

function TableExportDisplay({
  field,
  value,
}: {
  field: Extract<FormField, { type: 'table' }>;
  value: FieldValue;
}) {
  const rows = parseTableAnswer(value).filter((row) => !isTableRowBlank(row));
  if (rows.length === 0) {
    return <div className="export-input">No rows entered</div>;
  }
  return (
    <div className="export-table-field-wrap">
      <table className="export-table-field">
        <thead>
          <tr>
            {field.columns.map((column) => (
              <th key={column.id}>{column.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: rows have no stable id — same reasoning as the respondent-facing TableControl in field-input.tsx
            <tr key={rowIndex}>
              {field.columns.map((column) => {
                const cell = row[column.id] ?? '';
                const text =
                  column.type === 'dropdown'
                    ? (column.options?.find((option) => option.id === cell)?.label ?? cell)
                    : cell;
                return <td key={column.id}>{text}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function QuestionTableExportDisplay({
  field,
  value,
}: {
  field: Extract<FormField, { type: 'question_table' }>;
  value: FieldValue;
}) {
  // Colors are per-field-instance here (headerColor/headerTextColor/valueColor live on
  // the field itself), unlike the whole-form branding.layoutStyle table theme's CSS
  // custom properties — see the schema comment on questionTableFieldSchema for why these
  // are deliberately separate, parallel styling mechanisms.
  const answer = parseQuestionTableAnswer(typeof value === 'string' ? value : undefined);
  const headerStyle: CSSProperties = {
    backgroundColor: field.headerColor,
    color: field.headerTextColor,
  };
  const valueStyle: CSSProperties = {
    backgroundColor: field.valueColor,
  };

  return (
    <div className="export-question-table-wrap">
      <table className="export-question-table">
        <thead>
          <tr>
            <th style={headerStyle}>{field.fieldColumnLabel || 'Field'}</th>
            <th style={headerStyle}>{field.valueColumnLabel || 'Details'}</th>
          </tr>
        </thead>
        <tbody>
          {field.rows.map((row) => {
            const raw = answer[row.id] ?? '';
            let text = raw;
            if (raw && row.type === 'dropdown') {
              text = row.options?.find((option) => option.id === raw)?.label ?? raw;
            } else if (raw && row.type === 'date') {
              text = formatDateValue(raw);
            }
            return (
              <tr key={row.id}>
                <td className="export-question-table-label-cell">{row.label}</td>
                <td style={valueStyle}>{text || '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function submissionFieldWidthClass(field: FormField): string {
  return `field-width--${resolveFieldWidth(field)}`;
}
