import { formatFullNameAnswer, parseFullNameAnswer } from '@/lib/forms/compound-answer';
import {
  expandPageFieldIds,
  FILENAME_PREFIX_ELIGIBLE_FIELD_TYPES,
  type FormSchema,
} from '@/lib/forms/schema';

// The first column of the Responses list is configurable per form (Settings → Responses list):
// whichever field identifies a response in that industry — a client name, a job number, a site.

const ELIGIBLE_TYPES: readonly string[] = [...FILENAME_PREFIX_ELIGIBLE_FIELD_TYPES, 'full_name'];

export interface ResponseLabelCandidate {
  id: string;
  label: string;
}

export function listResponseLabelCandidates(schema: FormSchema): ResponseLabelCandidate[] {
  const out: ResponseLabelCandidate[] = [];
  for (const page of schema.pages) {
    for (const fieldId of expandPageFieldIds(page, schema.fields)) {
      const field = schema.fields[fieldId];
      if (field && ELIGIBLE_TYPES.includes(field.type)) {
        out.push({ id: field.id, label: field.label ?? '' });
      }
    }
  }
  return out;
}

/** Display text for one answer; null when blank or not representable as a short label. */
export function formatResponseLabel(
  schema: FormSchema | undefined,
  fieldId: string,
  value: unknown,
): string | null {
  const field = schema?.fields[fieldId];
  if (field?.type === 'full_name') {
    const text = formatFullNameAnswer(
      parseFullNameAnswer(typeof value === 'string' ? value : undefined),
    );
    return text || null;
  }
  if (typeof value === 'string') return value.trim() || null;
  if (typeof value === 'number') return String(value);
  if (Array.isArray(value) && value.every((v) => typeof v === 'string')) {
    return value.join(', ') || null;
  }
  return null;
}

/**
 * Who/what a response is about: the field the form owner picked as the identifying column (a
 * client name, a job number…) when one is set and filled in, otherwise null so callers can fall
 * back to something else. Deliberately does not guess from field labels — a form can have
 * several "name" fields (staff, client, witness) and the guess picks the wrong one.
 */
export function configuredResponseLabel(
  schema: FormSchema | undefined,
  labelFieldId: string | null,
  answers: Record<string, unknown>,
): string | null {
  if (!labelFieldId) return null;
  return formatResponseLabel(schema, labelFieldId, answers[labelFieldId]);
}
