'use client';

import { useEffect, useState } from 'react';
import { formatDateTime, formatShortDate } from '@/lib/format-date';

/** True after the first client render — lets date text switch from UTC (identical on server and
 * client, so hydration matches) to the viewer's own timezone. */
export function useMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}

/** A date like "12 Jul 2026" with the full date and time as a hover tooltip. */
export function LocalDate({ iso }: { iso: string }) {
  const mounted = useMounted();
  return <span title={formatDateTime(iso, mounted)}>{formatShortDate(iso, mounted)}</span>;
}

/** Date and time like "12 Jul 2026, 7:51 AM" in the viewer's timezone (UTC until mounted). */
export function LocalDateTime({ iso }: { iso: string }) {
  const mounted = useMounted();
  return <span>{formatDateTime(iso, mounted)}</span>;
}
