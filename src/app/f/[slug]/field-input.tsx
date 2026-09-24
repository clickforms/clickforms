'use client';

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { ChangeEvent, CSSProperties } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { DrawOnImagePad } from '@/app/f/[slug]/draw-on-image-pad';
import { SignaturePad } from '@/app/f/[slug]/signature-pad';
import { DatePickerField } from '@/components/date-picker/date-picker-field';
import { TimePickerField } from '@/components/time-picker/time-picker-field';
import { evaluateCalculationFormula, formatCalculationResult } from '@/lib/forms/calculation';
import {
  parseAddressAnswer,
  parseChoiceMatrixAnswer,
  parseFullNameAnswer,
  parseQuestionTableAnswer,
  parseTableAnswer,
  serializeAddressAnswer,
  serializeChoiceMatrixAnswer,
  serializeFullNameAnswer,
  serializeQuestionTableAnswer,
  serializeTableAnswer,
  type TableRowAnswer,
} from '@/lib/forms/compound-answer';
import type { FormAnswers } from '@/lib/forms/conditional-logic';
import { getFieldImageSrc } from '@/lib/forms/field-image';
import {
  fieldHasCustomAppearance,
  resolveDividerCaptionStyle,
  resolveDividerLineStyle,
  resolveDividerWrapStyle,
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
import { OTHER_OPTION_ID } from '@/lib/forms/other-option';
import { DEFAULT_TABLE_ROWS, type FieldOption, type FormField } from '@/lib/forms/schema';
import { applyMask, maskPlaceholder } from '@/lib/forms/text-mask';

// Renders a single field's input control, switching on FormField's discriminant. Owns no
// answer state itself (the wizard in form-renderer-client.tsx is the single source of
// truth for `answers`) except for the transient "is this file/signature currently
// uploading" state, which is local and per-field since it has no bearing on form
// progress/validation — only the resulting fileId (written via onChange) does.

export type FieldValue = string | string[] | undefined;

// Stable empty array reused as the "no options" fallback below — a fresh `[]` literal on
// every render would be referentially unequal each time, which is harmless here (nothing
// keys off its identity) but avoiding needless allocations in a per-field render is a
// habit worth keeping in this file.
const EMPTY_OPTIONS: FieldOption[] = [];

/** Shuffles `options` once per mount (stable across re-renders of the same field instance)
 * when `randomizeOrder` is set — matches WPForms/Paperform's "randomize choice order",
 * which reshuffles per respondent session rather than on every render (a respondent
 * re-ordering under their own eyes while filling the form out would be disorienting). */
function useOrderedOptions<T>(options: T[], randomizeOrder: boolean | undefined): T[] {
  // `options` is included in the dependency list for correctness (this is the public
  // renderer, not the builder — `schema`/`field.options` is loaded once per page view and
  // doesn't change identity between re-renders here, so this doesn't cause re-shuffling
  // while a respondent is answering; only a genuinely new options array — e.g. a fresh
  // form load — produces a fresh shuffle).
  return useMemo(() => {
    if (!randomizeOrder) return options;
    const shuffled = [...options];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j] as T, shuffled[i] as T];
    }
    return shuffled;
  }, [randomizeOrder, options]);
}

interface FieldInputProps {
  slug?: string;
  /** Set alongside previewMode so image fields can resolve against the draft version
   * instead of the slug-based route, which 404s on an unpublished form (see
   * lib/forms/field-image.ts). */
  formId?: string;
  /** Set by the admin template builder's preview (template-preview/[id]/page.tsx), which
   * has neither a slug nor a formId — its fields live on a FormTemplate. See
   * lib/forms/field-image.ts for how this takes priority over the other two. */
  templateId?: string;
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
  templateId,
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
  // Hooks must run unconditionally, in the same order, on every render of a given
  // FieldInput instance — so this is computed up front for every field type (falling
  // back to an empty options list for types that don't carry one) rather than only
  // inside the multi_choice/checkbox/dropdown JSX branches further down, which would put
  // the hook call after the early returns below for hidden/section_break/image/static_text.
  const rawOptions =
    field.type === 'multi_choice' || field.type === 'checkbox' || field.type === 'dropdown'
      ? field.options
      : EMPTY_OPTIONS;
  const randomizeOrder =
    field.type === 'multi_choice' || field.type === 'checkbox' || field.type === 'dropdown'
      ? field.randomizeOrder
      : false;
  const orderedOptions = useOrderedOptions(rawOptions, randomizeOrder);
  const allowOther =
    (field.type === 'multi_choice' || field.type === 'checkbox' || field.type === 'dropdown') &&
    field.allowOther === true;
  const optionsWithOther = allowOther
    ? [...orderedOptions, { id: OTHER_OPTION_ID, label: 'Other' }]
    : orderedOptions;

  // Never rendered — its value is populated programmatically (see the hidden-field
  // auto-population effect in form-renderer-client.tsx), not typed by the respondent.
  // Still a real field with a real answer, just with no on-page presence.
  if (field.type === 'hidden') {
    return null;
  }

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

  if (field.type === 'divider') {
    const captionEl = field.label ? (
      <span className="form-divider-caption" style={resolveDividerCaptionStyle(field)}>
        {field.label}
      </span>
    ) : null;
    return (
      <div className="form-divider-wrap">
        <div className="form-divider-box" style={resolveDividerWrapStyle(field)}>
          {(field.captionPosition ?? 'above') === 'above' ? captionEl : null}
          <div className="form-divider-line" style={resolveDividerLineStyle(field)} />
          {field.captionPosition === 'below' ? captionEl : null}
        </div>
      </div>
    );
  }

  if (field.type === 'image') {
    if (!field.imageStorageKey || !(templateId || formId || slug)) {
      return null;
    }
    const src = getFieldImageSrc({
      slug,
      formId,
      templateId,
      fieldId: field.id,
      preferFormId: previewMode,
    });
    if (!src) return null;
    const align = field.align ?? 'center';
    const imageEl = (
      // biome-ignore lint/performance/noImgElement: dynamic/presigned image URLs; next/image is a poor fit here
      <img
        src={src}
        alt={field.alt ?? field.label}
        className="form-image-field-img"
        style={resolveImageStyle(field)}
      />
    );
    return (
      <div
        className={`form-image-field form-image-field--align-${align}`}
        style={resolveImageSpacingStyle(field)}
      >
        {field.label ? <p className="form-image-field-caption">{field.label}</p> : null}
        {field.linkUrl ? (
          <a
            href={field.linkUrl}
            target="_blank"
            rel="noreferrer"
            className="form-image-field-link"
          >
            {imageEl}
          </a>
        ) : (
          imageEl
        )}
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
          placeholder={field.placeholder}
          value={typeof value === 'string' ? value : ''}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : null}

      {field.type === 'paragraph' ? (
        <textarea
          id={field.id}
          className="text-input form-field-input"
          rows={field.rows ?? 4}
          style={inputStyle}
          placeholder={field.placeholder}
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
          {optionsWithOther.map((option) => {
            const isOtherRow = option.id === OTHER_OPTION_ID;
            const selected = isOtherRow
              ? value === OTHER_OPTION_ID ||
                (typeof value === 'string' &&
                  value.length > 0 &&
                  !field.options.some((o) => o.id === value))
              : value === option.id;
            return (
              <label key={option.id} className="form-option-row">
                <input
                  type="radio"
                  name={field.id}
                  value={option.id}
                  checked={selected}
                  onChange={() => onChange(isOtherRow ? OTHER_OPTION_ID : option.id)}
                />
                {option.label}
                {isOtherRow && selected ? (
                  <input
                    type="text"
                    className="text-input form-option-other-input"
                    placeholder="Please specify"
                    value={value === OTHER_OPTION_ID ? '' : typeof value === 'string' ? value : ''}
                    onChange={(event) => onChange(event.target.value || OTHER_OPTION_ID)}
                    onClick={(event) => event.stopPropagation()}
                  />
                ) : null}
              </label>
            );
          })}
        </div>
      ) : null}

      {field.type === 'checkbox' ? (
        <div
          className={`form-option-list ${useOptionGrid ? 'form-option-list--grid' : ''}`}
          style={inputStyle}
        >
          {optionsWithOther.map((option) => {
            const isOtherRow = option.id === OTHER_OPTION_ID;
            const current = Array.isArray(value) ? value : [];
            const otherEntry = current.find((v) => !field.options.some((o) => o.id === v));
            const selected = isOtherRow ? otherEntry !== undefined : current.includes(option.id);
            return (
              <label key={option.id} className="form-option-row">
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={() => {
                    if (isOtherRow) {
                      onChange(
                        selected
                          ? current.filter((v) => v !== otherEntry)
                          : [...current, OTHER_OPTION_ID],
                      );
                      return;
                    }
                    onChange(
                      selected ? current.filter((v) => v !== option.id) : [...current, option.id],
                    );
                  }}
                />
                {option.label}
                {isOtherRow && selected ? (
                  <input
                    type="text"
                    className="text-input form-option-other-input"
                    placeholder="Please specify"
                    value={otherEntry === OTHER_OPTION_ID ? '' : (otherEntry ?? '')}
                    onChange={(event) => {
                      const text = event.target.value;
                      const rest = current.filter((v) => v !== otherEntry);
                      onChange([...rest, text || OTHER_OPTION_ID]);
                    }}
                    onClick={(event) => event.stopPropagation()}
                  />
                ) : null}
              </label>
            );
          })}
        </div>
      ) : null}

      {field.type === 'dropdown' ? (
        <>
          <select
            id={field.id}
            className="text-input form-field-input"
            style={inputStyle}
            value={
              typeof value === 'string' && field.options.some((o) => o.id === value)
                ? value
                : allowOther && typeof value === 'string' && value.length > 0
                  ? OTHER_OPTION_ID
                  : ''
            }
            onChange={(event) => onChange(event.target.value || undefined)}
          >
            <option value="">{field.placeholder || 'Select…'}</option>
            {optionsWithOther.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
          {allowOther &&
          typeof value === 'string' &&
          value.length > 0 &&
          !field.options.some((o) => o.id === value) ? (
            <input
              type="text"
              className="text-input form-field-input form-option-other-input"
              placeholder="Please specify"
              value={value === OTHER_OPTION_ID ? '' : value}
              onChange={(event) => onChange(event.target.value || OTHER_OPTION_ID)}
            />
          ) : null}
        </>
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
          placeholder={field.placeholder}
          value={typeof value === 'string' ? value : ''}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : null}

      {field.type === 'masked_text' ? (
        <input
          id={field.id}
          type="text"
          className="text-input form-field-input"
          style={inputStyle}
          placeholder={field.placeholder || maskPlaceholder(field.mask)}
          value={typeof value === 'string' ? value : ''}
          onChange={(event) => onChange(applyMask(event.target.value, field.mask))}
        />
      ) : null}

      {field.type === 'calculation' ? (
        <CalculationControl field={field} value={value} onChange={onChange} answers={answers} />
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

      {field.type === 'address' ? (
        <AddressControl
          value={value}
          onChange={onChange}
          includeCountry={field.includeCountry ?? false}
        />
      ) : null}

      {field.type === 'full_name' ? (
        <FullNameControl
          value={value}
          onChange={onChange}
          includePrefix={field.includePrefix ?? false}
          includeMiddleName={field.includeMiddleName ?? false}
        />
      ) : null}

      {field.type === 'choice_matrix' ? (
        <ChoiceMatrixControl field={field} value={value} onChange={onChange} />
      ) : null}

      {field.type === 'table' ? (
        <TableControl field={field} value={value} onChange={onChange} />
      ) : null}

      {field.type === 'question_table' ? (
        <QuestionTableControl field={field} value={value} onChange={onChange} />
      ) : null}

      {field.type === 'number' ? (
        <div className="form-number-field">
          {field.prefix ? <span className="form-number-field-affix">{field.prefix}</span> : null}
          <input
            id={field.id}
            type="number"
            className="text-input form-field-input"
            style={inputStyle}
            placeholder={field.placeholder}
            min={field.validation?.min}
            max={field.validation?.max}
            step={field.validation?.step}
            value={typeof value === 'string' ? value : ''}
            onChange={(event) => onChange(event.target.value)}
          />
          {field.suffix ? <span className="form-number-field-affix">{field.suffix}</span> : null}
        </div>
      ) : null}

      {field.type === 'phone' ? (
        <div className="form-number-field">
          {field.defaultCountryCode ? (
            <span className="form-number-field-affix">{field.defaultCountryCode}</span>
          ) : null}
          <input
            id={field.id}
            type="tel"
            className="text-input form-field-input"
            style={inputStyle}
            autoComplete="tel"
            placeholder={field.placeholder ?? '+61 4XX XXX XXX'}
            value={typeof value === 'string' ? value : ''}
            onChange={(event) => onChange(event.target.value)}
          />
        </div>
      ) : null}

      {field.type === 'website' ? (
        <input
          id={field.id}
          type="url"
          className="text-input form-field-input"
          style={inputStyle}
          autoComplete="url"
          placeholder={field.placeholder ?? 'https://example.com'}
          value={typeof value === 'string' ? value : ''}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : null}

      {field.type === 'rating' ? (
        <RatingControl field={field} value={value} onChange={onChange} />
      ) : null}

      {field.type === 'opinion_scale' ? (
        <OpinionScaleControl field={field} value={value} onChange={onChange} />
      ) : null}

      {field.type === 'legal' ? (
        <LegalControl field={field} value={value} onChange={onChange} />
      ) : null}

      {field.type === 'yes_no' ? (
        <YesNoControl field={field} value={value} onChange={onChange} />
      ) : null}

      {field.type === 'ranking' ? (
        <RankingControl field={field} value={value} onChange={onChange} />
      ) : null}

      {field.type === 'picture_choice' ? (
        <PictureChoiceControl field={field} value={value} onChange={onChange} />
      ) : null}

      {field.type === 'draw_on_image' ? (
        <DrawOnImageControl
          field={field}
          value={value}
          onChange={onChange}
          onUploadFile={onUploadFile}
          slug={slug}
          formId={formId}
          templateId={templateId}
          previewMode={previewMode}
        />
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

interface FileUploadControlProps {
  field: Extract<FormField, { type: 'file_upload' }>;
  value: FieldValue;
  onChange: (value: FieldValue) => void;
  onUploadFile?: (fieldId: string, file: File) => Promise<string>;
}

function FileUploadControl({ field, value, onChange, onUploadFile }: FileUploadControlProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  // fileId -> original filename, purely a display nicety (SubmissionFile rows already
  // carry filename server-side; this just avoids a round-trip to show it immediately
  // after upload). Keyed by id rather than a parallel array so removing one file mid-list
  // can't desync the id/name pairing.
  const [fileNames, setFileNames] = useState<Record<string, string>>({});

  const multiple = field.multiple === true;
  const currentFileIds = multiple
    ? Array.isArray(value)
      ? value
      : []
    : typeof value === 'string' && value
      ? [value]
      : [];
  const atMaxFiles =
    multiple && field.maxFiles !== undefined && currentFileIds.length >= field.maxFiles;
  const accept = field.validation?.acceptedTypes?.join(',');
  const dropzoneLabel = multiple ? 'Tap to upload documents' : 'Tap to upload a document';
  const dropzoneHint = [
    field.validation?.acceptedTypes?.length
      ? `Accepted: ${field.validation.acceptedTypes.join(', ')}`
      : null,
    field.validation?.maxSizeMb ? `Max. file size: ${field.validation.maxSizeMb}MB` : null,
  ]
    .filter((part): part is string => part !== null)
    .join(' · ');

  async function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    // Reset immediately so picking the same file again after a "Remove" still fires onChange.
    event.target.value = '';
    if (files.length === 0 || !onUploadFile) return;

    const remainingSlots = multiple
      ? (field.maxFiles ?? Number.POSITIVE_INFINITY) - currentFileIds.length
      : 1;
    const toUpload = files.slice(0, Math.max(0, remainingSlots));

    setUploading(true);
    setUploadError(null);
    try {
      const uploaded: string[] = [];
      for (const file of toUpload) {
        const fileId = await onUploadFile(field.id, file);
        setFileNames((prev) => ({ ...prev, [fileId]: file.name }));
        uploaded.push(fileId);
      }
      onChange(multiple ? [...currentFileIds, ...uploaded] : uploaded[0]);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  }

  function handleRemove(fileId: string) {
    setUploadError(null);
    if (multiple) {
      onChange(currentFileIds.filter((id) => id !== fileId));
    } else {
      onChange(undefined);
    }
  }

  return (
    <div className="form-field-file">
      {currentFileIds.length > 0 ? (
        <ul className="form-field-file-list">
          {currentFileIds.map((fileId) => (
            <li key={fileId} className="form-field-file-status">
              <span>{fileNames[fileId] ?? 'File uploaded'} ✓</span>
              <button
                type="button"
                className="button button--ghost button--small"
                onClick={() => handleRemove(fileId)}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {!atMaxFiles ? (
        <label
          className={`form-field-file-dropzone ${uploading ? 'form-field-file-dropzone--disabled' : ''}`}
          htmlFor={field.id}
        >
          <span className="form-field-file-dropzone-icon" aria-hidden="true">
            <CloudUploadIcon />
          </span>
          <span className="form-field-file-dropzone-label">
            {uploading ? 'Uploading…' : dropzoneLabel}
          </span>
          {dropzoneHint ? (
            <span className="form-field-file-dropzone-hint">{dropzoneHint}</span>
          ) : null}
          <input
            id={field.id}
            type="file"
            className="form-field-file-input"
            accept={accept}
            multiple={multiple}
            disabled={uploading}
            onChange={handleChange}
          />
        </label>
      ) : (
        <p className="form-field-help">Maximum of {field.maxFiles} files reached.</p>
      )}
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
// draw_on_image — respondent annotates an admin-uploaded background image on a
// <canvas>, then the flattened (background + annotations) PNG uploads through the exact
// same presign/PUT/confirm pipeline signature/file_upload already use (see
// DrawOnImagePad and lib/s3.ts's isFormFieldImageKey — the background itself is fetched
// via the same field-image API route the `image` field type uses).
// ---------------------------------------------------------------------------

interface DrawOnImageControlProps {
  field: Extract<FormField, { type: 'draw_on_image' }>;
  value: FieldValue;
  onChange: (value: FieldValue) => void;
  onUploadFile?: (fieldId: string, file: File) => Promise<string>;
  slug?: string;
  formId?: string;
  templateId?: string;
  previewMode?: boolean;
}

function DrawOnImageControl({
  field,
  value,
  onChange,
  onUploadFile,
  slug,
  formId,
  templateId,
  previewMode,
}: DrawOnImageControlProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const currentFileId = typeof value === 'string' ? value : undefined;
  const backgroundSrc =
    field.imageStorageKey && (templateId || formId || slug)
      ? (getFieldImageSrc({
          slug,
          formId,
          templateId,
          fieldId: field.id,
          preferFormId: previewMode,
        }) ?? undefined)
      : undefined;

  async function handleSave(blob: Blob) {
    if (!onUploadFile) return;
    setUploading(true);
    setUploadError(null);
    try {
      const file = new File([blob], 'drawing.png', { type: 'image/png' });
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
        <span>Drawing submitted ✓</span>
        <button
          type="button"
          className="button button--ghost button--small"
          onClick={() => {
            setUploadError(null);
            onChange(undefined);
          }}
        >
          Clear and redraw
        </button>
      </div>
    );
  }

  return (
    <div>
      <DrawOnImagePad
        imageSrc={backgroundSrc}
        strokeColor={field.strokeColor}
        strokeWidth={field.strokeWidth}
        onSave={handleSave}
        saving={uploading}
      />
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
  includeCountry: boolean;
}

function AddressControl({ value, onChange, includeCountry }: AddressControlProps) {
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
      {includeCountry ? (
        <input
          type="text"
          className="text-input form-field-input"
          placeholder="Country"
          value={address.country}
          onChange={(event) => update({ country: event.target.value })}
        />
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// full_name — 2-4 sub-inputs (optional prefix, first, optional middle, last); the answer
// stored in `value` is a single JSON string (see lib/forms/compound-answer.ts), same
// pattern as AddressControl above.
// ---------------------------------------------------------------------------

interface FullNameControlProps {
  value: FieldValue;
  onChange: (value: FieldValue) => void;
  includePrefix: boolean;
  includeMiddleName: boolean;
}

function FullNameControl({
  value,
  onChange,
  includePrefix,
  includeMiddleName,
}: FullNameControlProps) {
  const name = parseFullNameAnswer(value);

  function update(partial: Partial<typeof name>) {
    onChange(serializeFullNameAnswer({ ...name, ...partial }));
  }

  return (
    <div className="form-full-name-field">
      {includePrefix ? (
        <input
          type="text"
          className="text-input form-field-input form-full-name-prefix"
          placeholder="Prefix"
          value={name.prefix}
          onChange={(event) => update({ prefix: event.target.value })}
        />
      ) : null}
      <input
        type="text"
        className="text-input form-field-input"
        placeholder="First name"
        autoComplete="given-name"
        value={name.first}
        onChange={(event) => update({ first: event.target.value })}
      />
      {includeMiddleName ? (
        <input
          type="text"
          className="text-input form-field-input"
          placeholder="Middle name"
          value={name.middle}
          onChange={(event) => update({ middle: event.target.value })}
        />
      ) : null}
      <input
        type="text"
        className="text-input form-field-input"
        placeholder="Last name"
        autoComplete="family-name"
        value={name.last}
        onChange={(event) => update({ last: event.target.value })}
      />
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

// ---------------------------------------------------------------------------
// rating — a row of star buttons; the answer is the chosen star count as a plain string
// (e.g. "4"), the same string-valued shape every other single-answer field uses.
// ---------------------------------------------------------------------------

interface RatingControlProps {
  field: Extract<FormField, { type: 'rating' }>;
  value: FieldValue;
  onChange: (value: FieldValue) => void;
}

// Path data for each RATING_ICON_OPTIONS value, all drawn on the same 18x18 viewBox so
// swapping icons never shifts the control's layout/spacing.
const RATING_ICON_PATHS: Record<string, string> = {
  star: 'M9 2.7l1.8 3.65 4 .58-2.9 2.83.68 4-3.58-1.88-3.58 1.88.68-4-2.9-2.83 4-.58L9 2.7Z',
  heart:
    'M9 15.5S2.5 11.4 2.5 6.9C2.5 4.5 4.4 3 6.4 3 7.6 3 8.6 3.6 9 4.5 9.4 3.6 10.4 3 11.6 3c2 0 3.9 1.5 3.9 3.9 0 4.5-6.5 8.6-6.5 8.6Z',
  thumb:
    'M2.8 8.2h2.9v7.1H2.8a.7.7 0 0 1-.7-.7V8.9a.7.7 0 0 1 .7-.7Zm4.3.4 2.6-5.4a1.3 1.3 0 0 1 2.4.9l-.8 3.2h3.4a1.4 1.4 0 0 1 1.35 1.85l-1.5 4.9a1.4 1.4 0 0 1-1.34 1H7.1',
};

function RatingControl({ field, value, onChange }: RatingControlProps) {
  const max = field.maxRating ?? 5;
  const selected = typeof value === 'string' ? Number(value) : 0;
  const iconPath = RATING_ICON_PATHS[field.icon ?? 'star'] ?? RATING_ICON_PATHS.star;
  const style = field.color ? ({ '--form-rating-color': field.color } as CSSProperties) : undefined;

  return (
    <div className="form-rating" role="radiogroup" aria-label={field.label} style={style}>
      {Array.from({ length: max }, (_, index) => index + 1).map((star) => (
        <button
          key={star}
          type="button"
          className={`form-rating-star ${star <= selected ? 'form-rating-star--filled' : ''}`}
          aria-pressed={star <= selected}
          aria-label={`${star} out of ${max}`}
          onClick={() => onChange(star === selected ? undefined : String(star))}
        >
          <svg width="26" height="26" viewBox="0 0 18 18" fill="none" aria-hidden="true">
            <path
              d={iconPath}
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinejoin="round"
              strokeLinecap="round"
              fill={star <= selected ? 'currentColor' : 'none'}
            />
          </svg>
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// opinion_scale — a horizontal row of numbered buttons (NPS-style); the answer is the
// chosen number as a plain string, same shape as rating above.
// ---------------------------------------------------------------------------

interface OpinionScaleControlProps {
  field: Extract<FormField, { type: 'opinion_scale' }>;
  value: FieldValue;
  onChange: (value: FieldValue) => void;
}

function OpinionScaleControl({ field, value, onChange }: OpinionScaleControlProps) {
  const min = field.scaleMin ?? 0;
  const max = field.scaleMax ?? 10;
  const steps = Array.from({ length: max - min + 1 }, (_, index) => min + index);

  return (
    <div className="form-opinion-scale">
      <div className="form-opinion-scale-row" role="radiogroup" aria-label={field.label}>
        {steps.map((step) => {
          const stepValue = String(step);
          const selected = value === stepValue;
          return (
            <button
              key={step}
              type="button"
              className={`form-opinion-scale-step ${selected ? 'form-opinion-scale-step--selected' : ''}`}
              aria-pressed={selected}
              onClick={() => onChange(selected ? undefined : stepValue)}
            >
              {step}
            </button>
          );
        })}
      </div>
      {field.minLabel || field.maxLabel ? (
        <div className="form-opinion-scale-labels">
          <span>{field.minLabel}</span>
          {field.midLabel ? (
            <span className="form-opinion-scale-mid-label">{field.midLabel}</span>
          ) : null}
          <span>{field.maxLabel}</span>
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// legal — a single "I agree..." consent checkbox; the answer is the string "true" when
// checked, undefined otherwise, so required-ness can reuse the generic isBlank() check
// in validate-answers.ts without a dedicated boolean answer shape.
// ---------------------------------------------------------------------------

interface LegalControlProps {
  field: Extract<FormField, { type: 'legal' }>;
  value: FieldValue;
  onChange: (value: FieldValue) => void;
}

function LegalControl({ field, value, onChange }: LegalControlProps) {
  const checked = value === 'true';
  return (
    <label className="form-legal-row">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked ? 'true' : undefined)}
      />
      <span>
        {field.consentText}
        {field.linkUrl ? (
          <>
            {' '}
            <a href={field.linkUrl} target="_blank" rel="noreferrer" className="form-legal-link">
              {field.linkLabel || 'View'}
            </a>
          </>
        ) : null}
      </span>
    </label>
  );
}

// ---------------------------------------------------------------------------
// yes_no — two buttons; the answer is always the fixed literal 'yes'/'no' (see
// YES_NO_VALUES in schema.ts), regardless of what yesLabel/noLabel currently say.
// ---------------------------------------------------------------------------

interface YesNoControlProps {
  field: Extract<FormField, { type: 'yes_no' }>;
  value: FieldValue;
  onChange: (value: FieldValue) => void;
}

function YesNoControl({ field, value, onChange }: YesNoControlProps) {
  return (
    <div className="form-yes-no-field" role="radiogroup">
      <button
        type="button"
        className={`form-yes-no-option ${value === 'yes' ? 'form-yes-no-option--selected' : ''}`}
        aria-pressed={value === 'yes'}
        onClick={() => onChange(value === 'yes' ? undefined : 'yes')}
      >
        {field.yesLabel || 'Yes'}
      </button>
      <button
        type="button"
        className={`form-yes-no-option ${value === 'no' ? 'form-yes-no-option--selected' : ''}`}
        aria-pressed={value === 'no'}
        onClick={() => onChange(value === 'no' ? undefined : 'no')}
      >
        {field.noLabel || 'No'}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ranking — a drag-to-reorder list over a fixed, admin-authored set of items. The answer
// is an array of option ids in the respondent's chosen order (index 0 = top-ranked) —
// already exactly FormAnswers' existing string[] shape (same as checkbox), so no
// lib/forms/compound-answer.ts serialization is needed here; order carries the meaning
// instead of membership. Drag reordering (dnd-kit, same library the admin builder uses)
// is the primary interaction, with up/down buttons alongside for keyboard/no-drag access.
// ---------------------------------------------------------------------------

interface RankingControlProps {
  field: Extract<FormField, { type: 'ranking' }>;
  value: FieldValue;
  onChange: (value: FieldValue) => void;
}

function RankingControl({ field, value, onChange }: RankingControlProps) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  // The respondent's current order once they've touched it; otherwise falls back to the
  // admin-authored option order. Tolerates a saved order that references an option
  // deleted since submission (dropped) or one added since (appended) rather than
  // crashing or losing items.
  const orderedIds = useMemo(() => {
    const optionIds = field.options.map((option) => option.id);
    if (!Array.isArray(value) || value.length === 0) return optionIds;
    const known = value.filter((id) => optionIds.includes(id));
    const missing = optionIds.filter((id) => !known.includes(id));
    return [...known, ...missing];
  }, [field.options, value]);

  const labelById = useMemo(
    () => new Map(field.options.map((option) => [option.id, option.label])),
    [field.options],
  );

  function moveItem(fromIndex: number, toIndex: number) {
    if (toIndex < 0 || toIndex >= orderedIds.length) return;
    onChange(arrayMove(orderedIds, fromIndex, toIndex));
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const fromIndex = orderedIds.indexOf(String(active.id));
    const toIndex = orderedIds.indexOf(String(over.id));
    if (fromIndex === -1 || toIndex === -1) return;
    onChange(arrayMove(orderedIds, fromIndex, toIndex));
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={orderedIds} strategy={verticalListSortingStrategy}>
        <div className="form-ranking-field">
          {orderedIds.map((id, index) => (
            <RankingItem
              key={id}
              id={id}
              index={index}
              label={labelById.get(id) ?? id}
              isFirst={index === 0}
              isLast={index === orderedIds.length - 1}
              onMoveUp={() => moveItem(index, index - 1)}
              onMoveDown={() => moveItem(index, index + 1)}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

function RankingItem({
  id,
  index,
  label,
  isFirst,
  isLast,
  onMoveUp,
  onMoveDown,
}: {
  id: string;
  index: number;
  label: string;
  isFirst: boolean;
  isLast: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });
  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`form-ranking-item ${isDragging ? 'form-ranking-item--dragging' : ''}`}
    >
      <span className="form-ranking-item-index">{index + 1}</span>
      <span className="form-ranking-item-label">{label}</span>
      <div className="form-ranking-item-controls">
        <button
          type="button"
          className="form-ranking-move-btn"
          disabled={isFirst}
          onClick={onMoveUp}
          aria-label={`Move ${label} up`}
        >
          ▲
        </button>
        <button
          type="button"
          className="form-ranking-move-btn"
          disabled={isLast}
          onClick={onMoveDown}
          aria-label={`Move ${label} down`}
        >
          ▼
        </button>
        <span
          className="form-ranking-item-handle"
          aria-hidden="true"
          {...attributes}
          {...listeners}
        >
          ⠿
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// picture_choice — a grid of image tiles, single-select (radio semantics, same as
// multi_choice) — the answer is a plain option id, same shape as multi_choice/dropdown.
// ---------------------------------------------------------------------------

interface PictureChoiceControlProps {
  field: Extract<FormField, { type: 'picture_choice' }>;
  value: FieldValue;
  onChange: (value: FieldValue) => void;
}

function PictureChoiceControl({ field, value, onChange }: PictureChoiceControlProps) {
  const orderedOptions = useOrderedOptions(field.options, field.randomizeOrder);
  return (
    <div className="form-picture-choice-grid" role="radiogroup">
      {orderedOptions.map((option) => {
        const selected = value === option.id;
        return (
          <button
            key={option.id}
            type="button"
            className={`form-picture-choice-tile ${selected ? 'form-picture-choice-tile--selected' : ''}`}
            aria-pressed={selected}
            onClick={() => onChange(selected ? undefined : option.id)}
          >
            {option.imageUrl ? (
              // biome-ignore lint/performance/noImgElement: admin-supplied arbitrary URL, next/image requires a known host
              <img src={option.imageUrl} alt={option.label} className="form-picture-choice-image" />
            ) : (
              <div className="form-picture-choice-placeholder" aria-hidden="true">
                <svg width="28" height="28" viewBox="0 0 18 18" fill="none" aria-hidden="true">
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
            <span className="form-picture-choice-label">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// calculation — a read-only field whose value is computed from other fields' answers via
// lib/forms/calculation.ts's {fieldId}-token arithmetic formula language, rather than
// typed by the respondent. Recomputes whenever any dependency's answer changes (this
// effect re-runs on every `answers` change — cheap, since evaluateCalculationFormula is a
// small string substitution + a short recursive-descent parse, not a network call) and
// writes the result back into `answers` via onChange so it submits like a real answer.
// ---------------------------------------------------------------------------

interface CalculationControlProps {
  field: Extract<FormField, { type: 'calculation' }>;
  value: FieldValue;
  onChange: (value: FieldValue) => void;
  answers: FormAnswers | undefined;
}

function CalculationControl({ field, value, onChange, answers }: CalculationControlProps) {
  const result = useMemo(
    () => evaluateCalculationFormula(field.formula, answers ?? {}),
    [field.formula, answers],
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: only the computed result (not the previous value/onChange identity) should trigger a rewrite — including them would either loop (onChange changes each render in some parents) or skip a legitimate recompute
  useEffect(() => {
    const nextValue = result === null ? undefined : String(result);
    if (nextValue !== value) {
      onChange(nextValue);
    }
  }, [result]);

  const display = formatCalculationResult(result, {
    decimalPlaces: field.decimalPlaces,
    prefix: field.prefix,
    suffix: field.suffix,
  });

  return (
    <div className="form-calculation-field">
      <span className="form-calculation-value">{display || '—'}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// table — a repeatable input table (Jotform's "Input Table"): the respondent fills in
// however many rows they need (bounded by minRows/maxRows) using the admin-configured
// columns. The answer is a JSON-serialized array of row objects (columnId -> cell text),
// same "structured answer packed into one string" pattern as address/choice_matrix above.
// ---------------------------------------------------------------------------

interface TableControlProps {
  field: Extract<FormField, { type: 'table' }>;
  value: FieldValue;
  onChange: (value: FieldValue) => void;
}

function TableControl({ field, value, onChange }: TableControlProps) {
  const rows = parseTableAnswer(value);
  // Always render at least `defaultRows` (or DEFAULT_TABLE_ROWS) worth of rows, even
  // before the respondent has typed anything — an input table with zero visible rows
  // would look broken, not just empty.
  const minVisibleRows = Math.max(field.minRows ?? 0, field.defaultRows ?? DEFAULT_TABLE_ROWS, 1);
  const visibleRows: TableRowAnswer[] =
    rows.length >= minVisibleRows
      ? rows
      : [...rows, ...Array.from({ length: minVisibleRows - rows.length }, () => ({}))];

  function updateCell(rowIndex: number, columnId: string, cellValue: string) {
    const next = visibleRows.map((row, index) =>
      index === rowIndex ? { ...row, [columnId]: cellValue } : row,
    );
    onChange(serializeTableAnswer(next));
  }

  function addRow() {
    onChange(serializeTableAnswer([...visibleRows, {}]));
  }

  function removeRow(rowIndex: number) {
    onChange(serializeTableAnswer(visibleRows.filter((_, index) => index !== rowIndex)));
  }

  const canRemoveRows = visibleRows.length > (field.minRows ?? 0);
  const canAddRows = field.maxRows === undefined || visibleRows.length < field.maxRows;

  return (
    <div className="form-table-field-wrap">
      <table className="form-table-field">
        <thead>
          <tr>
            {field.columns.map((column) => (
              <th key={column.id}>{column.label}</th>
            ))}
            <th className="form-table-field-row-actions-header" />
          </tr>
        </thead>
        <tbody>
          {visibleRows.map((row, rowIndex) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: rows have no stable id of their own (respondent-added/removed in place) — index is the row's actual identity here
            <tr key={rowIndex}>
              {field.columns.map((column) => {
                const cellId = `${field.id}-${rowIndex}-${column.id}`;
                const cellValue = row[column.id] ?? '';
                return (
                  <td key={column.id}>
                    {column.type === 'dropdown' ? (
                      <select
                        id={cellId}
                        className="text-input form-field-input"
                        value={cellValue}
                        onChange={(event) => updateCell(rowIndex, column.id, event.target.value)}
                      >
                        <option value="">Select…</option>
                        {(column.options ?? []).map((option) => (
                          <option key={option.id} value={option.id}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    ) : column.type === 'date' ? (
                      <DatePickerField
                        id={cellId}
                        className="text-input form-field-input"
                        value={cellValue}
                        onChange={(nextValue) => updateCell(rowIndex, column.id, nextValue)}
                      />
                    ) : (
                      <input
                        id={cellId}
                        type={column.type === 'number' ? 'number' : 'text'}
                        className="text-input form-field-input"
                        value={cellValue}
                        onChange={(event) => updateCell(rowIndex, column.id, event.target.value)}
                      />
                    )}
                  </td>
                );
              })}
              <td className="form-table-field-row-actions">
                {canRemoveRows ? (
                  <button
                    type="button"
                    className="form-table-field-remove-row"
                    onClick={() => removeRow(rowIndex)}
                    aria-label="Remove row"
                  >
                    &times;
                  </button>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {canAddRows ? (
        <button type="button" className="form-table-field-add-row" onClick={addRow}>
          + Add row
        </button>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// question_table — the print-form label/value grid (e.g. an intake sheet's "Field" |
// "Details" table): every row is a fixed, admin-authored question with its own single
// answer, whose input type is chosen per row. Unlike `table` above, rows are never
// added/removed by the respondent — the row list itself is admin content, only the
// answers are respondent-authored. The answer is a JSON-serialized rowId -> answer map,
// same "structured answer packed into one string" pattern as address/choice_matrix/table.
// ---------------------------------------------------------------------------

interface QuestionTableControlProps {
  field: Extract<FormField, { type: 'question_table' }>;
  value: FieldValue;
  onChange: (value: FieldValue) => void;
}

function QuestionTableControl({ field, value, onChange }: QuestionTableControlProps) {
  const answer = parseQuestionTableAnswer(value);

  function updateRowAnswer(rowId: string, rowValue: string) {
    onChange(serializeQuestionTableAnswer({ ...answer, [rowId]: rowValue }));
  }

  const headerStyle: CSSProperties = {
    backgroundColor: field.headerColor,
    color: field.headerTextColor,
  };
  const valueStyle: CSSProperties = {
    backgroundColor: field.valueColor,
  };

  return (
    <div className="form-question-table-wrap">
      <table className="form-question-table">
        <thead>
          <tr>
            <th style={headerStyle}>{field.fieldColumnLabel || 'Field'}</th>
            <th style={headerStyle}>{field.valueColumnLabel || 'Details'}</th>
          </tr>
        </thead>
        <tbody>
          {field.rows.map((row) => {
            const cellId = `${field.id}-${row.id}`;
            const cellValue = answer[row.id] ?? '';
            return (
              <tr key={row.id}>
                <td className="form-question-table-label-cell">
                  {row.label}
                  {row.required ? <span className="form-field-required"> *</span> : null}
                </td>
                <td style={valueStyle}>
                  {row.type === 'dropdown' ? (
                    <select
                      id={cellId}
                      className="text-input form-field-input"
                      value={cellValue}
                      onChange={(event) => updateRowAnswer(row.id, event.target.value)}
                    >
                      <option value="">Select…</option>
                      {(row.options ?? []).map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  ) : row.type === 'date' ? (
                    <DatePickerField
                      id={cellId}
                      className="text-input form-field-input"
                      value={cellValue}
                      onChange={(nextValue) => updateRowAnswer(row.id, nextValue)}
                    />
                  ) : (
                    <input
                      id={cellId}
                      type={row.type === 'number' ? 'number' : 'text'}
                      className="text-input form-field-input"
                      value={cellValue}
                      onChange={(event) => updateRowAnswer(row.id, event.target.value)}
                    />
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
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
