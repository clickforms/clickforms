import { formatFullNameAnswer, parseFullNameAnswer } from '@/lib/forms/compound-answer';
import type { FormSchema } from '@/lib/forms/schema';

function asText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Best-effort "who responded" label for the Responses list. Prefers a Full Name field, then
 * a short-text field whose label mentions "name", then an email field. Returns null when
 * the form has none (the list falls back to an em dash).
 */
export function deriveParticipantName(
  schema: FormSchema,
  answers: Record<string, unknown>,
): string | null {
  const fields = Object.values(schema.fields);

  for (const field of fields) {
    if (field.type !== 'full_name') continue;
    const raw = answers[field.id];
    const name = formatFullNameAnswer(
      parseFullNameAnswer(typeof raw === 'string' ? raw : undefined),
    );
    if (name) return name;
  }

  for (const field of fields) {
    if (field.type !== 'short_text' || !/\bname\b/i.test(field.label)) continue;
    const text = asText(answers[field.id]);
    if (text) return text;
  }

  for (const field of fields) {
    if (field.type !== 'email') continue;
    const text = asText(answers[field.id]);
    if (text) return text;
  }

  return null;
}
