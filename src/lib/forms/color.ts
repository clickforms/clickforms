const HEX_6 = /^#[0-9a-fA-F]{6}$/;
const HEX_3 = /^#[0-9a-fA-F]{3}$/;
const RGB = /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/i;

function channelToHex(value: string): string {
  const n = Math.min(255, Math.max(0, Number(value)));
  return n.toString(16).padStart(2, '0');
}

export interface HsvColor {
  /** Hue, 0-360 (exclusive). */
  h: number;
  /** Saturation, 0-1. */
  s: number;
  /** Value/brightness, 0-1. */
  v: number;
}

/** Converts a normalized #rrggbb hex string to HSV — used by the spectrum color picker
 * (field-color-picker.tsx) to seed its saturation/brightness square + hue slider from
 * whatever hex value the field currently has. Returns null for anything that isn't a
 * clean 6-digit hex (callers should normalizeHexColor() first). */
export function hexToHsv(hex: string): HsvColor | null {
  if (!HEX_6.test(hex)) return null;
  const r = Number.parseInt(hex.slice(1, 3), 16) / 255;
  const g = Number.parseInt(hex.slice(3, 5), 16) / 255;
  const b = Number.parseInt(hex.slice(5, 7), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;

  let h = 0;
  if (d !== 0) {
    if (max === r) h = 60 * (((g - b) / d) % 6);
    else if (max === g) h = 60 * ((b - r) / d + 2);
    else h = 60 * ((r - g) / d + 4);
  }
  if (h < 0) h += 360;

  const s = max === 0 ? 0 : d / max;
  const v = max;

  return { h, s, v };
}

/** Converts HSV back to a lowercase #rrggbb hex string — the inverse of hexToHsv(), used
 * every time the respondent drags the spectrum picker's square or hue slider. */
export function hsvToHex({ h, s, v }: HsvColor): string {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;

  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];

  const toHex = (n: number) =>
    Math.round((n + m) * 255)
      .toString(16)
      .padStart(2, '0');

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/** Normalizes hex or rgb() strings to lowercase #rrggbb, or null if invalid. */
export function normalizeHexColor(input: string): string | null {
  let trimmed = input.trim();
  if (!trimmed) return null;

  // Accept a hex code pasted without its leading '#' -- e.g. Figma and many other design
  // tools display/copy hex as "9b1b1b" rather than "#9b1b1b". Without this, pasting one
  // of those fails HEX_6/HEX_3 below, commitHexInput() shows an error, and the field
  // silently reverts to whatever color it had before -- indistinguishable from "paste
  // doesn't work" from the outside.
  if (!trimmed.startsWith('#') && /^[0-9a-f]{3}$|^[0-9a-f]{6}$/i.test(trimmed)) {
    trimmed = `#${trimmed}`;
  }

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
