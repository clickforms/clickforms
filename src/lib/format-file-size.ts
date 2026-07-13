const UNITS = ['B', 'KB', 'MB', 'GB'] as const;

/** Renders a byte count the way a human expects to read it ("482 KB", "3.1 MB").
 * Bytes and KB are shown with no decimal place (fractions of a KB aren't meaningful
 * at a glance); MB and above get one decimal place. Used by the Files admin page. */
export function formatFileSize(sizeBytes: number): string {
  if (sizeBytes <= 0) return '0 B';

  let value = sizeBytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < UNITS.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  const decimals = unitIndex >= 2 ? 1 : 0;
  return `${value.toFixed(decimals)} ${UNITS[unitIndex]}`;
}
