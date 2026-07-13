/** ISO date string helpers — form answers store dates as YYYY-MM-DD. */

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function parseIsoDate(value: string | undefined): Date | undefined {
  if (!value || !ISO_DATE_RE.test(value)) return undefined;
  const parts = value.split('-').map(Number);
  const year = parts[0];
  const month = parts[1];
  const day = parts[2];
  if (year === undefined || month === undefined || day === undefined) return undefined;
  return new Date(year, month - 1, day);
}

export function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatIsoDateForDisplay(value: string | undefined): string {
  const date = parseIsoDate(value);
  if (!date) return '';
  return date.toLocaleDateString('en-AU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}
