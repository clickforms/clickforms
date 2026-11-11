import { readLocalPrefs } from '@/lib/local-prefs';
import { loadSyncedPrefs, saveSyncedPrefs } from '@/lib/synced-prefs';

export type StoredSubmissionStatus = 'all' | 'in_progress' | 'submitted' | 'approved' | 'rejected';

export type StoredSubmissionFilters = {
  search: string;
  status: StoredSubmissionStatus;
  from: string | null;
  to: string | null;
  page: number;
};

const STATUSES: readonly StoredSubmissionStatus[] = [
  'all',
  'in_progress',
  'submitted',
  'approved',
  'rejected',
];

function filtersKey(formId: string): string {
  return `clickforms.submissions.filters.${formId}`;
}

function pageKey(formId: string): string {
  return `clickforms.submissions.page.${formId}`;
}

const emptyFilters: StoredSubmissionFilters = {
  search: '',
  status: 'all',
  from: null,
  to: null,
  page: 1,
};

function parseSaved(saved: Record<string, unknown>, page: number): StoredSubmissionFilters {
  const status = saved.status;
  return {
    search: typeof saved.search === 'string' ? saved.search.slice(0, 200) : '',
    status:
      typeof status === 'string' && (STATUSES as readonly string[]).includes(status)
        ? (status as StoredSubmissionStatus)
        : 'all',
    from: typeof saved.from === 'string' ? saved.from : null,
    to: typeof saved.to === 'string' ? saved.to : null,
    page,
  };
}

function readStoredPage(formId: string): number {
  try {
    const rawPage = Number(window.sessionStorage.getItem(pageKey(formId)));
    if (Number.isInteger(rawPage) && rawPage >= 1) return rawPage;
  } catch {
    // sessionStorage unavailable: start on page 1.
  }
  return 1;
}

/** Instant restore from this browser's cache (search, status and date filters) plus the page
 * (remembered only for the current tab, so a new visit starts on page 1). */
export function readSubmissionFilters(formId: string): StoredSubmissionFilters {
  if (typeof window === 'undefined') return emptyFilters;
  const page = readStoredPage(formId);
  const saved = readLocalPrefs(filtersKey(formId));
  return saved ? parseSaved(saved, page) : { ...emptyFilters, page };
}

/** The filters saved on the user's account (they follow the person across devices and login
 * sessions), or null when none are saved or the request failed. */
export async function loadSyncedSubmissionFilters(
  formId: string,
): Promise<StoredSubmissionFilters | null> {
  const saved = await loadSyncedPrefs(filtersKey(formId));
  return saved ? parseSaved(saved, readStoredPage(formId)) : null;
}

export function writeSubmissionFilters(formId: string, filters: StoredSubmissionFilters): void {
  if (typeof window === 'undefined') return;
  saveSyncedPrefs(filtersKey(formId), {
    search: filters.search,
    status: filters.status,
    from: filters.from,
    to: filters.to,
  });
  try {
    window.sessionStorage.setItem(pageKey(formId), String(filters.page));
  } catch {
    // Ignore.
  }
}
