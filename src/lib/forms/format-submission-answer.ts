import { formatCalculationResult } from '@/lib/forms/calculation';
import {
  formatAddressAnswer,
  formatFullNameAnswer,
  isTableRowBlank,
  parseAddressAnswer,
  parseChoiceMatrixAnswer,
  parseFullNameAnswer,
  parseQuestionTableAnswer,
  parseTableAnswer,
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
  | { kind: 'matrix'; entries: { row: string; column: string }[] }
  | { kind: 'table'; columns: string[]; rows: string[][] };

export function formatSubmissionAnswer(
  field: FormField,
  value: unknown,
  resolveFiles: (fieldId: string) => ResolvedSubmissionFile[],
  fieldId: string,
): FormattedSubmissionAnswer {
  switch (field.type) {
    case 'section_break':
    case 'divider':
    case 'column_layout':
    case 'image':
    case 'static_text':
      return { kind: 'skip' };

    case 'short_text':
    case 'paragraph':
    case 'email':
    case 'phone':
    case 'website':
    case 'masked_text': {
      if (typeof value !== 'string' || !value) {
        return { kind: 'empty' };
      }
      return { kind: 'text', text: value, multiline: field.type === 'paragraph' };
    }

    case 'multi_choice':
    case 'dropdown':
    case 'picture_choice': {
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
    case 'signature':
    case 'draw_on_image': {
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

    case 'full_name': {
      const name = parseFullNameAnswer(typeof value === 'string' ? value : undefined);
      const formatted = formatFullNameAnswer(name);
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

    case 'table': {
      const answer = parseTableAnswer(typeof value === 'string' ? value : undefined);
      const filledRows = answer.filter((row) => !isTableRowBlank(row));
      if (filledRows.length === 0) {
        return { kind: 'empty' };
      }
      return {
        kind: 'table',
        columns: field.columns.map((column) => column.label),
        rows: filledRows.map((row) =>
          field.columns.map((column) => {
            const cell = row[column.id] ?? '';
            if (column.type !== 'dropdown') return cell;
            // Dropdown cells store the option id, same convention as the dropdown
            // field type itself — resolve to its label for display.
            return column.options?.find((option) => option.id === cell)?.label ?? cell;
          }),
        ),
      };
    }

    case 'question_table': {
      // Reuses the 'matrix' kind rather than adding a new one — same {row, column} shape
      // as choice_matrix's display (see submissions/[submissionId]/page.tsx's existing
      // `formatted.kind === 'matrix'` renderer), just with a free-form answer per row
      // instead of a chosen rating column.
      const answer = parseQuestionTableAnswer(typeof value === 'string' ? value : undefined);
      const answeredRows = field.rows.filter((row) => answer[row.id]?.trim());
      if (answeredRows.length === 0) {
        return { kind: 'empty' };
      }
      return {
        kind: 'matrix',
        entries: field.rows.map((row) => {
          const raw = answer[row.id] ?? '';
          if (!raw) {
            return { row: row.label, column: '—' };
          }
          if (row.type === 'dropdown') {
            const option = row.options?.find((o) => o.id === raw);
            return { row: row.label, column: option?.label ?? raw };
          }
          if (row.type === 'date') {
            const parsed = new Date(raw);
            const formatted = Number.isNaN(parsed.getTime())
              ? raw
              : parsed.toLocaleDateString('en-AU', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                });
            return { row: row.label, column: formatted };
          }
          return { row: row.label, column: raw };
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

    case 'calculation': {
      if (typeof value !== 'string' || !value) {
        return { kind: 'empty' };
      }
      const num = Number(value);
      if (Number.isNaN(num)) {
        return { kind: 'empty' };
      }
      const text = formatCalculationResult(num, {
        decimalPlaces: field.decimalPlaces,
        prefix: field.prefix,
        suffix: field.suffix,
      });
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

    case 'yes_no': {
      if (value !== 'yes' && value !== 'no') {
        return { kind: 'empty' };
      }
      return {
        kind: 'text',
        text: value === 'yes' ? field.yesLabel || 'Yes' : field.noLabel || 'No',
      };
    }

    case 'ranking': {
      if (!Array.isArray(value) || value.length === 0) {
        return { kind: 'empty' };
      }
      const labelById = new Map(field.options.map((option) => [option.id, option.label]));
      // Reuses the 'matrix' kind (row/column pairs) for a numbered list — the same
      // {row, column} shape choice_matrix/question_table already render as a <ul>, just
      // with a rank number standing in for choice_matrix's row label.
      return {
        kind: 'matrix',
        entries: value.map((id, index) => ({
          row: String(index + 1),
          column: labelById.get(id) ?? id,
        })),
      };
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
