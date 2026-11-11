// Remembers how the Forms list was last set up (search, status filter, sort, List/Grid) so it
// is still that way after navigating away, reloading or coming back another day. Kept in this
// browser's localStorage; reads and writes never throw (private mode / blocked storage just
// means nothing is remembered).

export type StoredStatusFilter = 'all' | 'live' | 'draft';
export type StoredSortColumn = 'name' | 'createdAt' | 'updatedAt' | 'responseCount' | 'status';
export type StoredSortDirection = 'asc' | 'desc';
export type StoredViewMode = 'list' | 'grid';

export interface FormsListPrefs {
  search: string;
  statusFilter: StoredStatusFilter;
  sortColumn: StoredSortColumn;
  sortDirection: StoredSortDirection;
  viewMode: StoredViewMode;
}

export const DEFAULT_FORMS_LIST_PREFS: FormsListPrefs = {
  search: '',
  statusFilter: 'all',
  sortColumn: 'updatedAt',
  sortDirection: 'desc',
  viewMode: 'list',
};

const STORAGE_KEY = 'clickforms.forms.list.prefs.v1';

const STATUS_FILTERS: readonly StoredStatusFilter[] = ['all', 'live', 'draft'];
const SORT_COLUMNS: readonly StoredSortColumn[] = [
  'name',
  'createdAt',
  'updatedAt',
  'responseCount',
  'status',
];

function pick<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

export function readFormsListPrefs(): FormsListPrefs {
  if (typeof window === 'undefined') return DEFAULT_FORMS_LIST_PREFS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_FORMS_LIST_PREFS;
    const parsed = JSON.parse(raw) as Partial<Record<keyof FormsListPrefs, unknown>>;
    return {
      search: typeof parsed.search === 'string' ? parsed.search.slice(0, 200) : '',
      statusFilter: pick(parsed.statusFilter, STATUS_FILTERS, 'all'),
      sortColumn: pick(parsed.sortColumn, SORT_COLUMNS, 'updatedAt'),
      sortDirection: pick(parsed.sortDirection, ['asc', 'desc'] as const, 'desc'),
      viewMode: pick(parsed.viewMode, ['list', 'grid'] as const, 'list'),
    };
  } catch {
    return DEFAULT_FORMS_LIST_PREFS;
  }
}

export function writeFormsListPrefs(prefs: FormsListPrefs): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Storage full or blocked: the list still works, it just won't be remembered.
  }
}
