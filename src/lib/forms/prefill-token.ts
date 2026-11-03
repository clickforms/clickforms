import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import type { FormAnswers } from '@/lib/forms/conditional-logic';
import type { FormSchema } from '@/lib/forms/schema';

// "Prefilled link" tokens: an admin fills in some answers, and the form's public URL gets a
// ?prefill=<token> param that pre-populates them for whoever opens the link. The answers can
// be personal (a client's name, address), so they are never put in the URL as readable
// query params — they are encrypted (AES-256-GCM, keyed off SESSION_SECRET) into an opaque
// token that is bound to one form and expires. Stateless: nothing is stored server-side.

const PREFILL_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_PAYLOAD_BYTES = 16 * 1024;

// Answers that can't be meaningfully pre-seeded from text (binary/drawn/derived values).
const NON_PREFILLABLE_TYPES = new Set([
  'file_upload',
  'signature',
  'draw_on_image',
  'calculation',
  'section_break',
  'divider',
  'static_text',
  'image',
  'column_layout',
]);

function key(): Buffer {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error('SESSION_SECRET must be set to create prefill links');
  }
  return createHash('sha256').update(`prefill:${secret}`).digest();
}

/** Keeps only string / string[] answers for fields that exist and accept a typed value. */
export function sanitizePrefillAnswers(schema: FormSchema, answers: unknown): FormAnswers {
  const result: FormAnswers = {};
  if (typeof answers !== 'object' || answers === null) return result;
  for (const [fieldId, value] of Object.entries(answers as Record<string, unknown>)) {
    const field = schema.fields[fieldId];
    if (!field || NON_PREFILLABLE_TYPES.has(field.type)) continue;
    if (typeof value === 'string') {
      if (value.trim()) result[fieldId] = value;
    } else if (Array.isArray(value) && value.every((item) => typeof item === 'string')) {
      if (value.length > 0) result[fieldId] = value as string[];
    }
  }
  return result;
}

export function createPrefillToken(formId: string, answers: FormAnswers): string {
  const payload = Buffer.from(
    JSON.stringify({ f: formId, a: answers, e: Date.now() + PREFILL_TTL_MS }),
  );
  if (payload.length > MAX_PAYLOAD_BYTES) {
    throw new Error('Prefilled answers are too large for a link.');
  }
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const encrypted = Buffer.concat([cipher.update(payload), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64url');
}

/** Returns the prefilled answers, or null for a bad, tampered, expired, or other-form token. */
export function readPrefillToken(token: string, formId: string): FormAnswers | null {
  try {
    const raw = Buffer.from(token, 'base64url');
    if (raw.length < 29 || raw.length > MAX_PAYLOAD_BYTES * 2) return null;
    const decipher = createDecipheriv('aes-256-gcm', key(), raw.subarray(0, 12));
    decipher.setAuthTag(raw.subarray(12, 28));
    const decrypted = Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]);
    const parsed = JSON.parse(decrypted.toString('utf8')) as {
      f?: string;
      a?: unknown;
      e?: number;
    };
    if (parsed.f !== formId || typeof parsed.e !== 'number' || parsed.e < Date.now()) return null;
    if (typeof parsed.a !== 'object' || parsed.a === null) return null;
    return parsed.a as FormAnswers;
  } catch {
    return null;
  }
}
