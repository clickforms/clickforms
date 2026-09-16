export type StoredSubmissionFilters = {
  search: string;
  from: string | null;
  to: string | null;
  page: number;
};

function storageKey(formId: string): string {
  return `clickforms.submissions.filters.${formId}`;
}

const emptyFilters: StoredSubmissionFilters = {
  search: '',
  from: null,
  to: null,
  page: 1,
};

/** Restores Responses list search/date/page after opening a submission and coming back. */
export function readSubmissionFilters(formId: string): StoredSubmissionFilters {
  if (typeof window === 'undefined') return emptyFilters;
  try {
    const raw = window.sessionStorage.getItem(storageKey(formId));
    if (!raw) return emptyFilters;
    const parsed = JSON.parse(raw) as Partial<StoredSubmissionFilters>;
    return {
      search: typeof parsed.search === 'string' ? parsed.search : '',
      from: typeof parsed.from === 'string' ? parsed.from : null,
      to: typeof parsed.to === 'string' ? parsed.to : null,
      page: typeof parsed.page === 'number' && parsed.page >= 1 ? parsed.page : 1,
    };
  } catch {
    return emptyFilters;
  }
}

export function writeSubmissionFilters(formId: string, filters: StoredSubmissionFilters): void {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(storageKey(formId), JSON.stringify(filters));
}
