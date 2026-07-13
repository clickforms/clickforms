import {
  isAddressAnswerBlank,
  parseAddressAnswer,
  parseChoiceMatrixAnswer,
} from '@/lib/forms/compound-answer';
import type { FormAnswers } from '@/lib/forms/conditional-logic';
import { getVisibleFieldIds } from '@/lib/forms/conditional-logic';
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
      if (typeof value !== 'string' || !optionIds.has(value)) {
        return 'Select a valid option.';
      }
      return null;
    }

    case 'checkbox': {
      const optionIds = new Set(field.options.map((option) => option.id));
      if (!Array.isArray(value) || value.some((v) => !optionIds.has(v))) {
        return 'Select a valid option.';
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
