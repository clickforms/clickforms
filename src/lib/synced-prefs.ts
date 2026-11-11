// UI preferences that follow the signed-in user across devices and login sessions.
// localStorage stays as an instant, flash-free cache (see local-prefs.ts); the server copy
// (/api/me/preferences) is the source of truth and wins on load. Writes are debounced and
// best-effort: a failed save never breaks the page, the local copy still works.

import { writeLocalPrefs } from '@/lib/local-prefs';

const SAVE_DELAY_MS = 600;
const LOAD_TIMEOUT_MS = 3000;

const timers = new Map<string, ReturnType<typeof setTimeout>>();
const lastSaved = new Map<string, string>();

/** Fetches the user's saved copy. Resolves null when there is none, or on any failure/timeout
 * (callers then keep whatever they restored locally). Also refreshes the local cache. */
export async function loadSyncedPrefs(key: string): Promise<Record<string, unknown> | null> {
  if (typeof window === 'undefined') return null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), LOAD_TIMEOUT_MS);
  try {
    const response = await fetch(`/api/me/preferences?key=${encodeURIComponent(key)}`, {
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const data = (await response.json()) as { value: unknown };
    const value = data.value;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const record = value as Record<string, unknown>;
      lastSaved.set(key, JSON.stringify(record));
      writeLocalPrefs(key, record);
      return record;
    }
    return null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/** Saves locally right away and to the account shortly after (debounced, skipped when unchanged). */
export function saveSyncedPrefs(key: string, value: Record<string, unknown>): void {
  writeLocalPrefs(key, value);
  const serialized = JSON.stringify(value);
  if (lastSaved.get(key) === serialized) return;
  const existing = timers.get(key);
  if (existing) clearTimeout(existing);
  timers.set(
    key,
    setTimeout(() => {
      timers.delete(key);
      void fetch('/api/me/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value }),
        keepalive: true,
      })
        .then((response) => {
          if (response.ok) lastSaved.set(key, serialized);
        })
        .catch(() => {});
    }, SAVE_DELAY_MS),
  );
}
