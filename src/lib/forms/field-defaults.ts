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
): string | string[] | undefined {
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
    case 'masked_text':
    case 'multi_choice':
    case 'dropdown':
    case 'yes_no':
    case 'picture_choice':
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

    case 'ranking':
      // Ranking has no admin-configured default — it's seeded to its own authored
      // item order so an untouched ranking still submits a real (if unmoved) answer
      // instead of a blank one, same reasoning as the string-valued defaults above.
      return field.options.map((option) => option.id);

    default:
      return undefined;
  }
}
