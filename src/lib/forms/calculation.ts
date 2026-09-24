import type { FormAnswers } from '@/lib/forms/conditional-logic';
import type { FormField } from '@/lib/forms/schema';

// The `calculation` field type's formula language: plain arithmetic (+ - * / and
// parentheses) over numeric literals and `{fieldId}` tokens referencing another field's
// current answer, e.g. "{a1b2} * {c3d4} * 0.1". Deliberately not `eval`/`new Function` —
// this string is admin-authored but ends up executed on every respondent's browser on
// every keystroke of every field it depends on, so it gets a small hand-rolled recursive-
// descent parser instead of running arbitrary JS.

const CALCULATION_TOKEN_PATTERN = /\{([^{}]+)\}/g;

/** Every field id referenced by `formula`, in the order they first appear. Used by the
 * builder settings panel to detect a formula that references a deleted field, and could
 * be reused for a "used by" dependency indicator on the source fields later. */
export function extractCalculationFieldIds(formula: string): string[] {
  const ids: string[] = [];
  for (const match of formula.matchAll(CALCULATION_TOKEN_PATTERN)) {
    const id = match[1];
    if (id && !ids.includes(id)) ids.push(id);
  }
  return ids;
}

/** Turns `{fieldId}` tokens into a readable "[Field Label]" preview so an admin editing
 * the formula can tell what it actually references — shown read-only alongside the raw
 * formula input, never fed back into the stored formula string itself. */
export function describeCalculationFormula(
  formula: string,
  fields: Record<string, FormField>,
): string {
  return formula.replace(CALCULATION_TOKEN_PATTERN, (_match, fieldId: string) => {
    const field = fields[fieldId];
    return `[${field?.label || 'Deleted field'}]`;
  });
}

/** A single respondent-facing answer's value coerced to a number for use inside a
 * formula — non-numeric/blank/array answers (an unanswered field, a checkbox's array, a
 * dropdown's option id, ...) resolve to 0 rather than aborting the whole calculation, the
 * same "missing input treated as zero" behavior spreadsheet formulas default to. */
function resolveNumericAnswer(value: string | string[] | undefined): number {
  if (typeof value !== 'string' || !value) return 0;
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

/** Hand-rolled recursive-descent parser/evaluator for +, -, *, /, unary minus, and
 * parentheses over decimal number literals — deliberately not `eval`, see the module
 * comment above. Returns null on any malformed expression (mismatched parens, a stray
 * operator, division by zero, ...) rather than throwing, so a mistyped formula just
 * renders as "no result" instead of crashing the form. */
export function evaluateArithmeticExpression(expr: string): number | null {
  const tokens = expr.match(/\d+\.?\d*|\.\d+|[+\-*/()]/g);
  if (!tokens || tokens.length === 0) return null;
  let pos = 0;

  const peek = () => tokens[pos];
  const consume = () => tokens[pos++];

  function parseExpression(): number | null {
    let left = parseTerm();
    if (left === null) return null;
    while (peek() === '+' || peek() === '-') {
      const op = consume();
      const right = parseTerm();
      if (right === null) return null;
      left = op === '+' ? left + right : left - right;
    }
    return left;
  }

  function parseTerm(): number | null {
    let left = parseFactor();
    if (left === null) return null;
    while (peek() === '*' || peek() === '/') {
      const op = consume();
      const right = parseFactor();
      if (right === null) return null;
      if (op === '/' && right === 0) return null;
      left = op === '*' ? left * right : left / right;
    }
    return left;
  }

  function parseFactor(): number | null {
    const token = peek();
    if (token === undefined) return null;
    if (token === '-') {
      consume();
      const value = parseFactor();
      return value === null ? null : -value;
    }
    if (token === '(') {
      consume();
      const value = parseExpression();
      if (value === null || peek() !== ')') return null;
      consume();
      return value;
    }
    const num = Number(token);
    if (Number.isNaN(num)) return null;
    consume();
    return num;
  }

  const result = parseExpression();
  if (result === null || pos !== tokens.length) return null; // leftover tokens = malformed
  return result;
}

/** Substitutes every `{fieldId}` token in `formula` with that field's current numeric
 * answer, then evaluates the resulting plain arithmetic expression. Returns null for an
 * empty/malformed formula (see evaluateArithmeticExpression) rather than throwing. */
export function evaluateCalculationFormula(formula: string, answers: FormAnswers): number | null {
  const substituted = formula.replace(CALCULATION_TOKEN_PATTERN, (_match, fieldId: string) =>
    String(resolveNumericAnswer(answers[fieldId])),
  );
  return evaluateArithmeticExpression(substituted);
}

/** Formats a calculation result for display — fixed decimal places (default 2, matching
 * the common "money" case) plus the field's optional prefix/suffix, same affix pattern as
 * the `number` field type's own prefix/suffix (see numberFieldSchema). */
export function formatCalculationResult(
  result: number | null,
  options: { decimalPlaces?: number; prefix?: string; suffix?: string },
): string {
  if (result === null) return '';
  const places = options.decimalPlaces ?? 2;
  return `${options.prefix ?? ''}${result.toFixed(places)}${options.suffix ?? ''}`;
}
