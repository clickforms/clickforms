import type { ConditionalRule, ConditionOperator, FormSchema } from '@/lib/forms/schema';

// Shared by the builder's live preview (spec 02) and the public renderer (spec 03), so
// "what the admin sees while building" and "what the respondent sees while filling it
// in" can never evaluate a condition differently.

/** Answers keyed by fieldId. Checkbox fields answer with string[]; everything else with string. */
export type FormAnswers = Record<string, string | string[] | undefined>;

function evaluateOperator(
  operator: ConditionOperator,
  answer: string | string[] | undefined,
  target: string,
): boolean {
  switch (operator) {
    case 'equals':
      return typeof answer === 'string' && answer === target;
    case 'not_equals':
      // An unanswered field is treated as "not equal to anything" — the field stays
      // hidden until the respondent actually picks a value that fails the condition,
      // rather than flashing visible before they've answered.
      return typeof answer === 'string' && answer !== target;
    case 'contains':
      return Array.isArray(answer) && answer.includes(target);
    default: {
      const exhaustiveCheck: never = operator;
      throw new Error(`Unhandled conditional operator: ${exhaustiveCheck}`);
    }
  }
}

function ruleMatches(rule: ConditionalRule, answers: FormAnswers): boolean {
  const answer = answers[rule.showIf.fieldId];
  return evaluateOperator(rule.showIf.operator, answer, rule.showIf.value);
}

/**
 * Returns the set of fieldIds that should currently be visible, given the schema's
 * conditional rules and the answers so far. A field with no rule targeting it is always
 * visible. A field targeted by a rule is visible only if the rule matches — v1 supports
 * at most one rule per field (spec 02: no nested AND/OR chains), so "the" rule for a
 * field, if any, is authoritative.
 */
export function getVisibleFieldIds(schema: FormSchema, answers: FormAnswers): Set<string> {
  const ruleByFieldId = new Map(schema.conditionalLogic.map((rule) => [rule.fieldId, rule]));
  const visible = new Set<string>();

  for (const fieldId of Object.keys(schema.fields)) {
    const rule = ruleByFieldId.get(fieldId);
    if (!rule || ruleMatches(rule, answers)) {
      visible.add(fieldId);
    }
  }

  return visible;
}

/** Convenience wrapper for a single field, e.g. inside a per-field React component. */
export function isFieldVisible(schema: FormSchema, fieldId: string, answers: FormAnswers): boolean {
  const rule = schema.conditionalLogic.find((r) => r.fieldId === fieldId);
  if (!rule) return true;
  return ruleMatches(rule, answers);
}
