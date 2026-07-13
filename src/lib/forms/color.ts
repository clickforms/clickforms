const HEX_6 = /^#[0-9a-fA-F]{6}$/;
const HEX_3 = /^#[0-9a-fA-F]{3}$/;
const RGB = /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/i;

function channelToHex(value: string): string {
  const n = Math.min(255, Math.max(0, Number(value)));
  return n.toString(16).padStart(2, '0');
}

/** Normalizes hex or rgb() strings to lowercase #rrggbb, or null if invalid. */
export function normalizeHexColor(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  if (HEX_6.test(trimmed)) {
    return trimmed.toLowerCase();
  }

  if (HEX_3.test(trimmed)) {
    const [, r, g, b] = trimmed.match(/^#(.)(.)(.)$/) ?? [];
    if (!r || !g || !b) return null;
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }

  const rgbMatch = trimmed.match(RGB);
  if (rgbMatch) {
    const [, r, g, b] = rgbMatch;
    if (!r || !g || !b) return null;
    return `#${channelToHex(r)}${channelToHex(g)}${channelToHex(b)}`;
  }

  return null;
}
