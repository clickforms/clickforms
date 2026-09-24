import type { FormAnswers } from '@/lib/forms/conditional-logic';
import type { FormField } from '@/lib/forms/schema';
import { isLayoutOnlyField } from '@/lib/forms/schema';

// Merge fields let a "Formatted Text" block reference another field's answer inline — e.g.
// "Thanks for applying for {label}, {name}." The RichTextEditor's "Insert form answers"
// picker inserts a token as a literal HTML span (see mergeTokenHtml below and the
// MergeToken Tiptap node in merge-token-node.ts) rather than a plain-text placeholder like
// {{fieldId}}, so it survives the editor's own HTML serialization and reads as a distinct
// chip while editing. Both resolvers below only ever match that shape — nothing else in
// the builder generates a `.merge-token` span.
//
// The pattern is deliberately attribute-order-agnostic (matches on the presence of
// class="merge-token" anywhere in the tag, then pulls data-field-id out separately) rather
// than assuming a fixed attribute order. Two editor implementations have written this
// markup over this project's life — a hand-built contentEditable editor, and the current
// Tiptap-based one — and while both are coded to emit attributes in the same literal
// order, the DOM's own serialization behavior isn't a contract either editor makes
// unprompted. Being order-agnostic means content written by either one (or an editor we
// haven't built yet) always resolves correctly, at negligible extra regex cost.
const MERGE_TOKEN_PATTERN = /<span\b([^>]*\bclass="merge-token"[^>]*)>([^<]*)<\/span>/g;

function extractMergeTokenFieldId(attributes: string): string | null {
  const match = attributes.match(/\bdata-field-id="([a-zA-Z0-9-]+)"/);
  return match?.[1] ?? null;
}

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
  return body.replace(MERGE_TOKEN_PATTERN, (_match, attributes: string) => {
    const fieldId = extractMergeTokenFieldId(attributes);
    const field = fieldId ? fields[fieldId] : undefined;
    if (!fieldId || !field) return '';
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
  return body.replace(MERGE_TOKEN_PATTERN, (_match, attributes: string) => {
    const fieldId = extractMergeTokenFieldId(attributes);
    const field = fieldId ? fields[fieldId] : undefined;
    const label = field && 'label' in field && field.label ? field.label : 'Deleted field';
    return `<span class="merge-token-preview">[${escapeHtml(label)}]</span>`;
  });
}
