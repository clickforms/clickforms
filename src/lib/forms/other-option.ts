// Sentinel id for the synthetic "Other" choice appended to multi_choice/checkbox/dropdown
// option lists when a field's `allowOther` setting is on (see optionFieldExtras in
// schema.ts). Never collides with a real option id (those come from OptionsEditor's own
// generated ids), so "is this the Other row" and "is this stored answer the free text a
// respondent typed into Other" can both be derived from a plain equality/membership check
// against the field's real `options` array — no separate piece of state needed to
// remember "Other was selected" across re-renders, page navigation, or server-side
// re-validation.
//
// Lives in its own tiny module (rather than field-input.tsx, where the UI that uses it
// lives) so both the client-only renderer and the server-side validate-answers.ts /
// format-submission-answer.ts can import it without either pulling in the other's
// 'use client' boundary or React-specific code.
export const OTHER_OPTION_ID = '__other__';
