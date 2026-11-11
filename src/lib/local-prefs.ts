// Tiny wrapper over localStorage for remembering UI choices (filters, sort, layout) across
// reloads and visits. Never throws: with storage blocked (private mode) nothing is remembered.

export function readLocalPrefs(key: string): Record<string, unknown> | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

export function writeLocalPrefs(key: string, value: Record<string, unknown>): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or blocked: the UI still works, it just isn't remembered.
  }
}
