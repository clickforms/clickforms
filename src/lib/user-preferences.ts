import { z } from 'zod';

/** Only these preference keys may be stored — one remembered-filter blob per list per form.
 * Keeps the table from becoming a general key/value dump. */
export const PREFERENCE_KEY_PATTERN =
  /^clickforms\.(submissions|prefills)\.filters\.[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const MAX_PREFERENCE_BYTES = 2048;

export const preferenceKeySchema = z.string().regex(PREFERENCE_KEY_PATTERN);

export const preferenceValueSchema = z
  .record(z.string(), z.unknown())
  .refine((value) => JSON.stringify(value).length <= MAX_PREFERENCE_BYTES, {
    message: 'Preference is too large',
  });
