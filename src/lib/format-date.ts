// Hand-built date formatting (no Intl) so server-rendered and client-rendered text match exactly —
// Intl output differs between Node and browsers (month names, "12/7" vs "12/07"), which causes
// hydration errors. `local` = false formats in UTC (used for the server render and first client
// render); true uses the viewer's timezone (applied after mount, see LocalDate / useMounted).

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function parts(iso: string, local: boolean) {
  const d = new Date(iso);
  return {
    day: local ? d.getDate() : d.getUTCDate(),
    month: local ? d.getMonth() : d.getUTCMonth(),
    year: local ? d.getFullYear() : d.getUTCFullYear(),
    hours: local ? d.getHours() : d.getUTCHours(),
    minutes: local ? d.getMinutes() : d.getUTCMinutes(),
  };
}

/** "12 Jul" */
export function formatDayMonth(iso: string, local = false): string {
  const p = parts(iso, local);
  return `${p.day} ${MONTHS[p.month]}`;
}

/** "12 Jul 2026" */
export function formatShortDate(iso: string, local = false): string {
  const p = parts(iso, local);
  return `${p.day} ${MONTHS[p.month]} ${p.year}`;
}

/** "12 Jul 2026, 7:51 AM" */
export function formatDateTime(iso: string, local = false): string {
  const p = parts(iso, local);
  const h12 = p.hours % 12 === 0 ? 12 : p.hours % 12;
  return `${formatShortDate(iso, local)}, ${h12}:${String(p.minutes).padStart(2, '0')} ${p.hours < 12 ? 'AM' : 'PM'}`;
}
