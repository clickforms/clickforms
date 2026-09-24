// Formatting/validation for the `masked_text` field type (schema.ts's
// maskedTextFieldSchema) — a plain string answer (same shape as short_text) constrained
// to a fixed character pattern the admin authors as a "mask" string, e.g. a US phone
// number as "(###) ###-####" or an SSN as "###-##-####". Token convention (matches the
// common react-input-mask/imask convention respondents/admins are likely already
// familiar with): '#' = a digit, 'A' = a letter, '*' = any letter or digit. Every other
// character in the mask is a literal that's inserted automatically as the respondent
// types, rather than something they type themselves.
export const MASK_TOKENS = {
  '#': /\d/,
  A: /[a-zA-Z]/,
  '*': /[a-zA-Z0-9]/,
} as const;

export function isMaskToken(char: string): char is keyof typeof MASK_TOKENS {
  return char === '#' || char === 'A' || char === '*';
}

/** Reformats free-typed `raw` input against `mask`, inserting the mask's literal
 * characters automatically and skipping any typed character that doesn't satisfy the
 * token type at its position — so pasting "555-123-4567" into a "(###) ###-####" mask
 * skips the dashes rather than rejecting the paste outright. Stops once every mask
 * position has been filled or `raw` runs out, whichever comes first. */
export function applyMask(raw: string, mask: string): string {
  let result = '';
  let rawIndex = 0;
  for (let maskIndex = 0; maskIndex < mask.length && rawIndex < raw.length; maskIndex++) {
    const maskChar = mask[maskIndex] as string;
    if (isMaskToken(maskChar)) {
      const pattern = MASK_TOKENS[maskChar];
      while (rawIndex < raw.length && !pattern.test(raw[rawIndex] as string)) {
        rawIndex++;
      }
      if (rawIndex >= raw.length) break;
      result += raw[rawIndex];
      rawIndex++;
    } else {
      result += maskChar;
      // If the respondent already typed the literal character themselves (e.g. typing
      // the "-" in a phone number by hand), consume it so it isn't duplicated;
      // otherwise it's inserted for free as part of auto-formatting.
      if (raw[rawIndex] === maskChar) rawIndex++;
    }
  }
  return result;
}

/** True when `value` fully and exactly matches `mask`'s shape — every token position
 * holds a character of the right type and every literal position holds that exact
 * character. An in-progress (shorter) value fails, same as leaving the field blank. */
export function isMaskSatisfied(value: string, mask: string): boolean {
  if (value.length !== mask.length) return false;
  for (let i = 0; i < mask.length; i++) {
    const maskChar = mask[i] as string;
    const valueChar = value[i] as string;
    if (isMaskToken(maskChar)) {
      if (!MASK_TOKENS[maskChar].test(valueChar)) return false;
    } else if (valueChar !== maskChar) {
      return false;
    }
  }
  return true;
}

/** Turns a mask like "(###) ###-####" into a fill-in-the-blank hint like "(000) 000-0000"
 * for the input's placeholder when the admin hasn't set an explicit one. */
export function maskPlaceholder(mask: string): string {
  return mask.replace(/[#A*]/g, (token) => (token === '#' ? '0' : token === 'A' ? 'A' : '_'));
}
