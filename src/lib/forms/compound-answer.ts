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
}

const EMPTY_ADDRESS: AddressAnswer = { street: '', suburb: '', state: '', postcode: '' };

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
    !address.postcode.trim()
  );
}

export function formatAddressAnswer(address: AddressAnswer): string {
  return [
    address.street,
    [address.suburb, address.state].filter(Boolean).join(' '),
    address.postcode,
  ]
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .join(', ');
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
