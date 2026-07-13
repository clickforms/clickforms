import type { FormAnswers } from '@/lib/forms/conditional-logic';
import type { FormField } from '@/lib/forms/schema';
import { isLayoutOnlyField } from '@/lib/forms/schema';

// Merge fields let a "Formatted Text" block reference another field's answer inline — e.g.
// "Thanks for applying for {label}, {name}." The RichTextEditor's "Insert form answers"
// picker inserts a token as a literal HTML span (see mergeTokenHtml below) rather than a
// plain-text placeholder like {{fieldId}}, so it survives contentEditable's own HTML
// serialization (innerHTML round-trips real DOM nodes, not markdown-ish text) and reads as
// a distinct chip while editing. Both resolvers below only ever match that exact shape —
// nothing else in the builder generates a `.merge-token` span — so the regex stays simple.
const MERGE_TOKEN_PATTERN =
  /<span class="merge-token" data-field-id="([a-zA-Z0-9-]+)" contenteditable="false">[^<]*<\/span>/g;

export function mergeTokenHtml(field: FormField): string {
  const label = 'label' in field && field.label ? field.label : 'Untitled field';
  return `<span class="merge-token" data-field-id="${field.id}" contenteditable="false">${escapeHtml(label)}</span>`;
}

/** Fields worth offering in the "Insert form answers" picker — real inputs only (never a
 * layout-only field like an image or another Formatted Text block, which has no answer),
 * and never the field currently being edited. */
export function mergeableFields(
  fields: Record<string, FormField>,
  excludeFieldId: string,
): FormField[] {
  return Object.values(fields).filter(
    (field) => field.id !== excludeFieldId && !isLayoutOnlyField(field.type),
  );
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function answerToDisplayText(value: string | string[] | undefined): string {
  if (!value) return '';
  return Array.isArray(value) ? value.join(', ') : value;
}

/** Public-renderer resolution: substitutes each merge token with the respondent's actual
 * answer so far (blank if they haven't reached/answered that field yet). Answer text is
 * HTML-escaped before injection — it's respondent-controlled free text being spliced into
 * an HTML string that gets rendered via dangerouslySetInnerHTML, so this is a real XSS
 * guard, not just tidiness. */
export function resolveMergeFieldsForRespondent(
  body: string,
  fields: Record<string, FormField>,
  answers: FormAnswers,
): string {
  return body.replace(MERGE_TOKEN_PATTERN, (_match, fieldId: string) => {
    const field = fields[fieldId];
    if (!field) return '';
    return escapeHtml(answerToDisplayText(answers[fieldId]));
  });
}

/** Builder-canvas resolution: no real answers exist yet, so tokens render as a bracketed
 * field-label placeholder (e.g. "[Job Title]") — enough for the admin to see at a glance
 * which fields a block pulls from without wiring the conditional-logic mock-answers state
 * all the way down through Canvas/FieldCard/FieldPreview. */
export function resolveMergeFieldsForPreview(
  body: string,
  fields: Record<string, FormField>,
): string {
  return body.replace(MERGE_TOKEN_PATTERN, (_match, fieldId: string) => {
    const field = fields[fieldId];
    const label = field && 'label' in field && field.label ? field.label : 'Deleted field';
    return `<span class="merge-token-preview">[${escapeHtml(label)}]</span>`;
  });
}
