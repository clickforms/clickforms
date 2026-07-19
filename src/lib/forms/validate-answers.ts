import {
  isAddressAnswerBlank,
  parseAddressAnswer,
  parseChoiceMatrixAnswer,
} from '@/lib/forms/compound-answer';
import type { FormAnswers } from '@/lib/forms/conditional-logic';
import { getVisibleFieldIds } from '@/lib/forms/conditional-logic';
import { OTHER_OPTION_ID } from '@/lib/forms/other-option';
import type { FormField, FormPage, FormSchema } from '@/lib/forms/schema';
import { expandPageFieldIds } from '@/lib/forms/schema';

// Shared by the public renderer (spec 03, client-side pre-submit checks) and the submit
// API route (server-side re-validation) — spec 03's acceptance criteria requires both:
// "blocked both client-side (immediate) and server-side (if the client check is
// bypassed via direct API call)". One implementation means the two can never disagree
// on what counts as a valid answer.

export type AnswerErrors = Record<string, string>;

function isBlank(value: string | string[] | undefined): boolean {
  if (value === undefined) return true;
  if (Array.isArray(value)) return value.length === 0;
  return value.trim().length === 0;
}

function validateField(field: FormField, value: string | string[] | undefined): string | null {
  switch (field.type) {
    case 'section_break':
    case 'column_layout':
    case 'image':
    case 'static_text':
    case 'hidden':
      return null;

    default:
      break;
  }

  // address/choice_matrix pack a structured answer into a single JSON string (see
  // lib/forms/compound-answer.ts) — the generic isBlank() string-length check below
  // doesn't understand that shape (an all-empty address is still a non-empty JSON
  // string), so their required-ness is checked here instead, ahead of the generic path.
  if (field.type === 'address') {
    if (field.required && isAddressAnswerBlank(parseAddressAnswer(value))) {
      return 'This field is required.';
    }
    return null;
  }

  if (field.type === 'choice_matrix') {
    if (field.required) {
      const answer = parseChoiceMatrixAnswer(value);
      const allRowsAnswered = field.rows.every((row) => Boolean(answer[row.id]));
      if (!allRowsAnswered) {
        return 'Please answer every row.';
      }
    }
    return null;
  }

  if (field.required && isBlank(value)) {
    return 'This field is required.';
  }
  if (isBlank(value)) {
    // Optional and empty — nothing further to check.
    return null;
  }

  switch (field.type) {
    case 'short_text':
    case 'paragraph': {
      const text = typeof value === 'string' ? value : '';
      if (field.validation?.minLength !== undefined && text.length < field.validation.minLength) {
        return `Must be at least ${field.validation.minLength} characters.`;
      }
      if (field.validation?.maxLength !== undefined && text.length > field.validation.maxLength) {
        return `Must be at most ${field.validation.maxLength} characters.`;
      }
      return null;
    }

    case 'multi_choice':
    case 'dropdown': {
      const optionIds = new Set(field.options.map((option) => option.id));
      if (typeof value !== 'string') {
        return 'Select a valid option.';
      }
      if (optionIds.has(value)) {
        return null;
      }
      // A value that isn't a real option id is only valid when it's respondent-typed
      // free text for an allowOther "Other" row — the bare OTHER_OPTION_ID sentinel
      // (Other clicked/selected but no text typed yet) still fails here, same as any
      // other blank answer would.
      if (field.allowOther && value !== OTHER_OPTION_ID) {
        return null;
      }
      return 'Select a valid option.';
    }

    case 'checkbox': {
      const optionIds = new Set(field.options.map((option) => option.id));
      if (!Array.isArray(value)) {
        return 'Select a valid option.';
      }
      const invalidEntry = value.find((v) => !optionIds.has(v));
      if (invalidEntry !== undefined) {
        const isValidOther =
          field.allowOther && invalidEntry !== OTHER_OPTION_ID && invalidEntry.length > 0;
        if (!isValidOther) {
          return 'Select a valid option.';
        }
      }
      if (field.minSelected !== undefined && value.length < field.minSelected) {
        return `Select at least ${field.minSelected}.`;
      }
      if (field.maxSelected !== undefined && value.length > field.maxSelected) {
        return `Select at most ${field.maxSelected}.`;
      }
      return null;
    }

    case 'date': {
      const dateValue = typeof value === 'string' ? value : '';
      if (Number.isNaN(Date.parse(dateValue))) {
        return 'Enter a valid date.';
      }
      // ISO YYYY-MM-DD strings sort lexically the same as chronologically, so plain
      // string comparison is correct here without parsing to a Date.
      if (field.validation?.minDate && dateValue < field.validation.minDate) {
        return `Must be on or after ${field.validation.minDate}.`;
      }
      if (field.validation?.maxDate && dateValue > field.validation.maxDate) {
        return `Must be on or before ${field.validation.maxDate}.`;
      }
      return null;
    }

    case 'time': {
      const timeValue = typeof value === 'string' ? value : '';
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(timeValue)) {
        return 'Enter a valid time.';
      }
      return null;
    }

    case 'email': {
      const emailValue = typeof value === 'string' ? value.trim() : '';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue)) {
        return 'Enter a valid email address.';
      }
      return null;
    }

    case 'file_upload':
    case 'signature':
      // Answer value is a SubmissionFile id (or array of ids for file_upload), written
      // only after a real upload completed via the presign/confirm flow — size and MIME
      // type were already enforced server-side at presign time (src/lib/s3.ts), so
      // presence of a non-blank value is all that needs checking here.
      return null;

    case 'number': {
      const numberValue = typeof value === 'string' ? Number(value) : Number.NaN;
      if (Number.isNaN(numberValue)) {
        return 'Enter a valid number.';
      }
      if (field.validation?.min !== undefined && numberValue < field.validation.min) {
        return `Must be at least ${field.validation.min}.`;
      }
      if (field.validation?.max !== undefined && numberValue > field.validation.max) {
        return `Must be at most ${field.validation.max}.`;
      }
      return null;
    }

    case 'phone': {
      const phoneValue = typeof value === 'string' ? value.trim() : '';
      // Permissive on purpose — no single format covers every country's numbers, and
      // v1 has no phone-formatting library dependency. Digits, spaces, and the usual
      // punctuation, at least 7 digits total (shortest plausible real phone number).
      const digitCount = (phoneValue.match(/\d/g) ?? []).length;
      if (!/^[+()\-.\s\d]+$/.test(phoneValue) || digitCount < 7) {
        return 'Enter a valid phone number.';
      }
      return null;
    }

    case 'website': {
      const raw = typeof value === 'string' ? value.trim() : '';
      // Respondents commonly type "example.com" without a protocol — accept that and
      // validate as if https:// were prepended, rather than forcing them to type it.
      const candidate = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
      try {
        const parsed = new URL(candidate);
        if (!parsed.hostname.includes('.')) {
          return 'Enter a valid website address.';
        }
      } catch {
        return 'Enter a valid website address.';
      }
      return null;
    }

    case 'rating': {
      const max = field.maxRating ?? 5;
      const numberValue = typeof value === 'string' ? Number(value) : Number.NaN;
      if (Number.isNaN(numberValue) || numberValue < 1 || numberValue > max) {
        return 'Select a rating.';
      }
      return null;
    }

    case 'opinion_scale': {
      const min = field.scaleMin ?? 0;
      const max = field.scaleMax ?? 10;
      const numberValue = typeof value === 'string' ? Number(value) : Number.NaN;
      if (Number.isNaN(numberValue) || numberValue < min || numberValue > max) {
        return 'Select a value on the scale.';
      }
      return null;
    }

    case 'legal':
      // The generic required/isBlank check above already covers this: the answer is the
      // literal string "true" when checked, undefined otherwise, so an unchecked-but-
      // required consent box fails the isBlank() gate before this switch is even reached.
      return null;

    default: {
      const exhaustiveCheck: never = field;
      throw new Error(
        `Unhandled field type in validateAnswers: ${JSON.stringify(exhaustiveCheck)}`,
      );
    }
  }
}

/** Validates every currently-visible field in the whole form — used just before final submit. */
export function validateAnswers(schema: FormSchema, answers: FormAnswers): AnswerErrors {
  const visibleFieldIds = getVisibleFieldIds(schema, answers);
  const errors: AnswerErrors = {};

  for (const fieldId of visibleFieldIds) {
    const field = schema.fields[fieldId];
    if (!field) continue;
    const error = validateField(field, answers[fieldId]);
    if (error) {
      errors[fieldId] = error;
    }
  }

  return errors;
}

/** Validates only the fields on one page — used for the per-page "Next" gate so a
 * respondent shouldn't be shown errors for pages they haven't reached yet. */
export function validatePageAnswers(
  schema: FormSchema,
  page: FormPage,
  answers: FormAnswers,
): AnswerErrors {
  const visibleFieldIds = getVisibleFieldIds(schema, answers);
  const errors: AnswerErrors = {};

  for (const fieldId of expandPageFieldIds(page, schema.fields)) {
    if (!visibleFieldIds.has(fieldId)) continue;
    const field = schema.fields[fieldId];
    if (!field || field.type === 'column_layout') continue;
    const error = validateField(field, answers[fieldId]);
    if (error) {
      errors[fieldId] = error;
    }
  }

  return errors;
}
