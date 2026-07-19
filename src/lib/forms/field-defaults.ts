import type { FormField } from '@/lib/forms/schema';

// Resolves the initial answer a field should carry before a respondent has touched it —
// either a fixed admin-configured default, or (for `hidden` fields only) a value pulled
// from the public form URL's query string. Centralized here so form-renderer-client.tsx's
// one mount effect can seed every field type's default with a single pass over
// schema.fields, instead of each FieldInput control re-implementing its own "did I get a
// default" logic and risking drift between what's submitted and what's displayed.
//
// Returns undefined when the field has no default (the common case) — callers should
// leave `answers` untouched in that case rather than writing an explicit undefined entry.
export function resolveFieldDefaultAnswer(
  field: FormField,
  params: URLSearchParams,
): string | undefined {
  switch (field.type) {
    case 'hidden': {
      const fromParam = field.sourceParam ? params.get(field.sourceParam) : null;
      return fromParam ?? field.defaultValue;
    }

    case 'short_text':
    case 'paragraph':
    case 'email':
    case 'phone':
    case 'website':
    case 'multi_choice':
    case 'dropdown':
      return field.defaultValue;

    case 'number':
      return field.defaultValue !== undefined ? String(field.defaultValue) : undefined;

    case 'date':
      if (field.defaultValue === 'today') {
        // Resolved at render time (respondent's local "today"), not baked in at save
        // time — see the schema comment on dateFieldSchema.defaultValue for why.
        return new Date().toISOString().slice(0, 10);
      }
      return field.defaultValue;

    default:
      return undefined;
  }
}
