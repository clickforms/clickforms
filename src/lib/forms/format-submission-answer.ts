import {
  formatAddressAnswer,
  parseAddressAnswer,
  parseChoiceMatrixAnswer,
} from '@/lib/forms/compound-answer';
import type { FormField } from '@/lib/forms/schema';
import { formatTimeForDisplay } from '@/lib/forms/time-value';

export interface ResolvedSubmissionFile {
  id: string;
  filename: string;
  url: string;
  mimeType: string;
}

export type FormattedSubmissionAnswer =
  | { kind: 'skip' }
  | { kind: 'empty' }
  | { kind: 'text'; text: string; multiline?: boolean }
  | { kind: 'files'; files: ResolvedSubmissionFile[] }
  | { kind: 'matrix'; entries: { row: string; column: string }[] };

export function formatSubmissionAnswer(
  field: FormField,
  value: unknown,
  resolveFiles: (fieldId: string) => ResolvedSubmissionFile[],
  fieldId: string,
): FormattedSubmissionAnswer {
  switch (field.type) {
    case 'section_break':
    case 'column_layout':
    case 'image':
    case 'static_text':
      return { kind: 'skip' };

    case 'short_text':
    case 'paragraph':
    case 'email':
    case 'phone':
    case 'website': {
      if (typeof value !== 'string' || !value) {
        return { kind: 'empty' };
      }
      return { kind: 'text', text: value, multiline: field.type === 'paragraph' };
    }

    case 'multi_choice':
    case 'dropdown': {
      if (typeof value !== 'string' || !value) {
        return { kind: 'empty' };
      }
      const option = field.options.find((o) => o.id === value);
      return { kind: 'text', text: option?.label ?? value };
    }

    case 'checkbox': {
      if (!Array.isArray(value) || value.length === 0) {
        return { kind: 'empty' };
      }
      const labels = value
        .filter((entry): entry is string => typeof entry === 'string')
        .map((entry) => field.options.find((o) => o.id === entry)?.label ?? entry);
      return { kind: 'text', text: labels.join(', ') };
    }

    case 'date': {
      if (typeof value !== 'string' || !value) {
        return { kind: 'empty' };
      }
      const parsed = new Date(value);
      const formatted = Number.isNaN(parsed.getTime())
        ? value
        : parsed.toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' });
      return { kind: 'text', text: formatted };
    }

    case 'time': {
      if (typeof value !== 'string' || !value) {
        return { kind: 'empty' };
      }
      return { kind: 'text', text: formatTimeForDisplay(value) || value };
    }

    case 'file_upload':
    case 'signature': {
      const files = resolveFiles(fieldId);
      if (files.length === 0) {
        return { kind: 'empty' };
      }
      return { kind: 'files', files };
    }

    case 'address': {
      const address = parseAddressAnswer(typeof value === 'string' ? value : undefined);
      const formatted = formatAddressAnswer(address);
      if (!formatted) {
        return { kind: 'empty' };
      }
      return { kind: 'text', text: formatted };
    }

    case 'choice_matrix': {
      const answer = parseChoiceMatrixAnswer(typeof value === 'string' ? value : undefined);
      const answeredRows = field.rows.filter((row) => answer[row.id]);
      if (answeredRows.length === 0) {
        return { kind: 'empty' };
      }
      return {
        kind: 'matrix',
        entries: answeredRows.map((row) => {
          const columnId = answer[row.id];
          const column = field.columns.find((c) => c.id === columnId);
          return { row: row.label, column: column?.label ?? columnId ?? '—' };
        }),
      };
    }

    case 'number': {
      if (typeof value !== 'string' || !value) {
        return { kind: 'empty' };
      }
      const text = [field.prefix, value, field.suffix].filter(Boolean).join('');
      return { kind: 'text', text };
    }

    case 'rating': {
      if (typeof value !== 'string' || !value) {
        return { kind: 'empty' };
      }
      const max = field.maxRating ?? 5;
      return { kind: 'text', text: `${value} / ${max}` };
    }

    case 'opinion_scale': {
      if (typeof value !== 'string' || !value) {
        return { kind: 'empty' };
      }
      const max = field.scaleMax ?? 10;
      return { kind: 'text', text: `${value} / ${max}` };
    }

    case 'legal': {
      if (value !== 'true') {
        return { kind: 'empty' };
      }
      return { kind: 'text', text: 'Agreed' };
    }

    case 'hidden': {
      if (typeof value !== 'string' || !value) {
        return { kind: 'empty' };
      }
      return { kind: 'text', text: value };
    }

    default: {
      const exhaustiveCheck: never = field;
      throw new Error(
        `Unhandled field type in submission answer formatting: ${JSON.stringify(exhaustiveCheck)}`,
      );
    }
  }
}
