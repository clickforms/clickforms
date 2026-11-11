import { readLocalPrefs, writeLocalPrefs } from '@/lib/local-prefs';

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

/** Restores the Responses list's search, status and date filters (remembered across visits in
 * this browser) and its page (remembered only for the current tab, so a new visit starts on
 * page 1). */
export function readSubmissionFilters(formId: string): StoredSubmissionFilters {
  if (typeof window === 'undefined') return emptyFilters;
  const saved = readLocalPrefs(filtersKey(formId));
  let page = 1;
  try {
    const rawPage = Number(window.sessionStorage.getItem(pageKey(formId)));
    if (Number.isInteger(rawPage) && rawPage >= 1) page = rawPage;
  } catch {
    // sessionStorage unavailable: start on page 1.
  }
  if (!saved) return { ...emptyFilters, page };
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

export function writeSubmissionFilters(formId: string, filters: StoredSubmissionFilters): void {
  if (typeof window === 'undefined') return;
  writeLocalPrefs(filtersKey(formId), {
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
