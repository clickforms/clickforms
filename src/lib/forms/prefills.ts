import 'server-only';

import { randomBytes } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import type { FormAnswers } from '@/lib/forms/conditional-logic';
import type { FormSchema } from '@/lib/forms/schema';

// Admin "prefills": a form with some answers pre-populated, emailed to one recipient. The
// answers live in the form_prefills table (not in the URL), and the link carries only an
// unguessable random token, so nothing personal ever appears in a URL. All access is raw SQL
// against form_prefills / the submissions.prefill_* columns.

export const PREFILL_TTL_MS = 30 * 24 * 60 * 60 * 1000;

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

export function generatePrefillToken(): string {
  return randomBytes(24).toString('base64url');
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

export type PrefillStatus = 'draft' | 'sent' | 'opened' | 'started' | 'completed' | 'expired';

export interface PrefillRow {
  id: string;
  recipient_email: string | null;
  is_draft: boolean;
  recipient_name: string | null;
  token: string;
  sent_at: Date | null;
  opened_at: Date | null;
  expires_at: Date;
  created_at: Date;
  created_by_name: string | null;
  responses: number;
  completed: number;
}

export function prefillStatus(row: {
  is_draft: boolean;
  opened_at: Date | null;
  expires_at: Date;
  responses: number;
  completed: number;
}): PrefillStatus {
  if (row.is_draft) return 'draft';
  if (row.completed > 0) return 'completed';
  if (row.expires_at.getTime() < Date.now()) return 'expired';
  if (row.responses > 0) return 'started';
  if (row.opened_at) return 'opened';
  return 'sent';
}

/** All prefills for one form, newest first, with response counts. Run inside withOrgContext. */
export async function listPrefills(tx: Prisma.TransactionClient, formId: string) {
  return tx.$queryRaw<PrefillRow[]>`
    SELECT p.id, p.is_draft, p.recipient_email, p.recipient_name, p.token, p.sent_at, p.opened_at,
           p.expires_at, p.created_at,
           COALESCE(u.name, u.email) AS created_by_name,
           (SELECT count(*)::int FROM submissions s
              WHERE s.prefill_id = p.id AND s.status <> 'in_progress') AS completed,
           (SELECT count(*)::int FROM submissions s WHERE s.prefill_id = p.id) AS responses
    FROM form_prefills p
    LEFT JOIN users u ON u.id = p.created_by
    WHERE p.form_id = ${formId}::uuid
    ORDER BY p.created_at DESC`;
}
