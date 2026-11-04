import { formatSubmissionAnswer } from '@/lib/forms/format-submission-answer';
import { expandPageFieldIds, type FormSchema, isLayoutOnlyField } from '@/lib/forms/schema';

export type CompareStatus = 'same' | 'changed' | 'added' | 'cleared' | 'original-only';

export interface CompareRow {
  fieldId: string;
  label: string;
  original: string | null;
  returned: string | null;
  status: CompareStatus;
}

function toText(schema: FormSchema, fieldId: string, value: unknown): string | null {
  const field = schema.fields[fieldId];
  if (!field || value === undefined || value === null || value === '') return null;
  const formatted = formatSubmissionAnswer(field, value, () => [], fieldId);
  switch (formatted.kind) {
    case 'text':
      return formatted.text.trim() || null;
    case 'files':
      return formatted.files.length > 0 ? `${formatted.files.length} file(s)` : 'File attached';
    case 'matrix':
      return formatted.entries.map((e) => `${e.row}: ${e.column}`).join('; ') || null;
    case 'table':
      return formatted.rows.length > 0 ? `${formatted.rows.length} row(s)` : null;
    default:
      return null;
  }
}

/** Field-by-field view of what was sent (the prefill's frozen answers) against what came back.
 * `returned` is null while no response exists yet — then every row is just the original. */
export function buildPrefillComparison(
  schema: FormSchema,
  original: Record<string, unknown>,
  returned: Record<string, unknown> | null,
): CompareRow[] {
  const rows: CompareRow[] = [];
  for (const page of schema.pages) {
    for (const fieldId of expandPageFieldIds(page, schema.fields)) {
      const field = schema.fields[fieldId];
      if (!field || isLayoutOnlyField(field.type) || field.type === 'column_layout') continue;
      const before = toText(schema, fieldId, original[fieldId]);
      const after = returned ? toText(schema, fieldId, returned[fieldId]) : null;
      if (!before && !after) continue;
      let status: CompareStatus;
      if (!returned) status = 'original-only';
      else if (before === after) status = 'same';
      else if (!before) status = 'added';
      else if (!after) status = 'cleared';
      else status = 'changed';
      rows.push({
        fieldId,
        label: ('label' in field && field.label) || 'Untitled field',
        original: before,
        returned: after,
        status,
      });
    }
  }
  return rows;
}
