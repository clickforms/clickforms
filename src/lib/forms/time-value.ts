/** Time helpers — form answers store times as HH:mm (24-hour). */

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function parseTimeValue(
  value: string | undefined,
): { hours: number; minutes: number } | null {
  if (!value) return null;
  const match = TIME_RE.exec(value);
  if (!match) return null;
  return { hours: Number(match[1]), minutes: Number(match[2]) };
}

export function toTimeValue(hours: number, minutes: number): string {
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

/** Display as "2:30 pm" (en-AU style). */
export function formatTimeForDisplay(value: string | undefined): string {
  const parsed = parseTimeValue(value);
  if (!parsed) return '';

  const period = parsed.hours >= 12 ? 'pm' : 'am';
  const hour12 = parsed.hours % 12 === 0 ? 12 : parsed.hours % 12;
  return `${hour12}:${String(parsed.minutes).padStart(2, '0')} ${period}`;
}

export function isValidTimeValue(value: string): boolean {
  return TIME_RE.test(value);
}
