// Two field types (address, choice_matrix) need more structure than a single string but
// FormAnswers' value type stays `string | string[] | undefined` everywhere else — rather
// than widen that type (and touch every consumer that assumes string/string[]), these two
// field types serialize their structured answer into a single JSON string and parse it
// back out. This file is the one place that (de)serialization happens, shared by the
// respondent-facing input (field-input.tsx), server-side validation (validate-answers.ts),
// and the submission detail view (submissions/[submissionId]/page.tsx) so they can never
// drift out of sync on the wire format.

export interface AddressAnswer {
  street: string;
  suburb: string;
  state: string;
  postcode: string;
  // Only ever populated when the field's `includeCountry` setting is on — omitted
  // (empty string) forms and forms saved before this field existed both parse the same
  // way, since JSON.parse simply won't find a `country` key on either.
  country: string;
}

const EMPTY_ADDRESS: AddressAnswer = {
  street: '',
  suburb: '',
  state: '',
  postcode: '',
  country: '',
};

export function parseAddressAnswer(value: string | string[] | undefined): AddressAnswer {
  if (typeof value !== 'string' || !value) return EMPTY_ADDRESS;
  try {
    const parsed: unknown = JSON.parse(value);
    if (typeof parsed !== 'object' || parsed === null) return EMPTY_ADDRESS;
    const record = parsed as Record<string, unknown>;
    return {
      street: typeof record.street === 'string' ? record.street : '',
      suburb: typeof record.suburb === 'string' ? record.suburb : '',
      state: typeof record.state === 'string' ? record.state : '',
      postcode: typeof record.postcode === 'string' ? record.postcode : '',
      country: typeof record.country === 'string' ? record.country : '',
    };
  } catch {
    return EMPTY_ADDRESS;
  }
}

export function serializeAddressAnswer(address: AddressAnswer): string {
  return JSON.stringify(address);
}

export function isAddressAnswerBlank(address: AddressAnswer): boolean {
  return (
    !address.street.trim() &&
    !address.suburb.trim() &&
    !address.state.trim() &&
    !address.postcode.trim() &&
    !address.country.trim()
  );
}

export function formatAddressAnswer(address: AddressAnswer): string {
  return [
    address.street,
    [address.suburb, address.state].filter(Boolean).join(' '),
    address.postcode,
    address.country,
  ]
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .join(', ');
}

// The `full_name` field type (see fullNameFieldSchema in schema.ts): prefix/middle are
// only ever populated when the field's includePrefix/includeMiddleName setting is on —
// same "unset key parses the same as an empty string" tolerance as AddressAnswer.country.
export interface FullNameAnswer {
  prefix: string;
  first: string;
  middle: string;
  last: string;
}

const EMPTY_FULL_NAME: FullNameAnswer = {
  prefix: '',
  first: '',
  middle: '',
  last: '',
};

export function parseFullNameAnswer(value: string | string[] | undefined): FullNameAnswer {
  if (typeof value !== 'string' || !value) return EMPTY_FULL_NAME;
  try {
    const parsed: unknown = JSON.parse(value);
    if (typeof parsed !== 'object' || parsed === null) return EMPTY_FULL_NAME;
    const record = parsed as Record<string, unknown>;
    return {
      prefix: typeof record.prefix === 'string' ? record.prefix : '',
      first: typeof record.first === 'string' ? record.first : '',
      middle: typeof record.middle === 'string' ? record.middle : '',
      last: typeof record.last === 'string' ? record.last : '',
    };
  } catch {
    return EMPTY_FULL_NAME;
  }
}

export function serializeFullNameAnswer(name: FullNameAnswer): string {
  return JSON.stringify(name);
}

export function isFullNameAnswerBlank(name: FullNameAnswer): boolean {
  return !name.prefix.trim() && !name.first.trim() && !name.middle.trim() && !name.last.trim();
}

export function formatFullNameAnswer(name: FullNameAnswer): string {
  return [name.prefix, name.first, name.middle, name.last]
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .join(' ');
}

/** rowId -> columnId */
export type ChoiceMatrixAnswer = Record<string, string>;

export function parseChoiceMatrixAnswer(value: string | string[] | undefined): ChoiceMatrixAnswer {
  if (typeof value !== 'string' || !value) return {};
  try {
    const parsed: unknown = JSON.parse(value);
    if (typeof parsed !== 'object' || parsed === null) return {};
    const record = parsed as Record<string, unknown>;
    const result: ChoiceMatrixAnswer = {};
    for (const [rowId, columnId] of Object.entries(record)) {
      if (typeof columnId === 'string') {
        result[rowId] = columnId;
      }
    }
    return result;
  } catch {
    return {};
  }
}

export function serializeChoiceMatrixAnswer(answer: ChoiceMatrixAnswer): string {
  return JSON.stringify(answer);
}

// The `table` field type (a repeatable input table — see tableFieldSchema in schema.ts):
// one row per respondent-added entry, each row a columnId -> cell-text map. Row order
// matters (it's the order the respondent entered them in), so this is an array, not a
// keyed object like ChoiceMatrixAnswer.
export type TableRowAnswer = Record<string, string>;
export type TableAnswer = TableRowAnswer[];

export function parseTableAnswer(value: string | string[] | undefined): TableAnswer {
  if (typeof value !== 'string' || !value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((row): TableRowAnswer => {
      if (typeof row !== 'object' || row === null) return {};
      const record = row as Record<string, unknown>;
      const result: TableRowAnswer = {};
      for (const [columnId, cell] of Object.entries(record)) {
        if (typeof cell === 'string') {
          result[columnId] = cell;
        }
      }
      return result;
    });
  } catch {
    return [];
  }
}

export function serializeTableAnswer(answer: TableAnswer): string {
  return JSON.stringify(answer);
}

/** A row counts as blank only when every one of its cells is empty — a row where the
 * respondent typed into just one column is still a real (partial) entry. */
export function isTableRowBlank(row: TableRowAnswer): boolean {
  return Object.values(row).every((cell) => !cell.trim());
}

export function isTableAnswerBlank(answer: TableAnswer): boolean {
  return answer.every(isTableRowBlank);
}

// The `question_table` field type ("Question Table" — a fixed label/value grid, e.g. a
// printed intake form's "Field"/"Details" table): rowId -> that row's single answer.
// Unlike TableAnswer, this is a plain map (no array/ordering concern) since rows are a
// fixed, admin-authored list — the same shape as ChoiceMatrixAnswer, just one free-form
// answer per row instead of a chosen column id.
export type QuestionTableAnswer = Record<string, string>;

export function parseQuestionTableAnswer(
  value: string | string[] | undefined,
): QuestionTableAnswer {
  if (typeof value !== 'string' || !value) return {};
  try {
    const parsed: unknown = JSON.parse(value);
    if (typeof parsed !== 'object' || parsed === null) return {};
    const record = parsed as Record<string, unknown>;
    const result: QuestionTableAnswer = {};
    for (const [rowId, answer] of Object.entries(record)) {
      if (typeof answer === 'string') {
        result[rowId] = answer;
      }
    }
    return result;
  } catch {
    return {};
  }
}

export function serializeQuestionTableAnswer(answer: QuestionTableAnswer): string {
  return JSON.stringify(answer);
}
