// Pure helpers for the admin Insights page (no server imports, easy to unit test).

export interface ReviewStatRow {
  company: string;
  role: string | null;
  rating: number | null;
  status: 'pending' | 'approved' | 'hidden';
}

export interface RatingSummary {
  /** Reviews that included a star rating. */
  rated: number;
  /** Mean of the ratings, one decimal, or null when nothing is rated. */
  average: number | null;
  /** Count for 1..5 stars, index 0 is one star. */
  distribution: [number, number, number, number, number];
}

export interface GroupStat {
  label: string;
  count: number;
  rated: number;
  average: number | null;
}

export function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

export function summarizeRatings(ratings: readonly (number | null)[]): RatingSummary {
  const distribution: [number, number, number, number, number] = [0, 0, 0, 0, 0];
  let total = 0;
  let rated = 0;
  for (const rating of ratings) {
    if (rating === null || rating < 1 || rating > 5) continue;
    const index = rating - 1;
    distribution[index] = (distribution[index] ?? 0) + 1;
    total += rating;
    rated += 1;
  }
  return { rated, average: rated > 0 ? round1(total / rated) : null, distribution };
}

/** Normalises free-text group keys so "Care Circle" and " care circle " count together. */
export function groupKey(value: string | null, fallback: string): { key: string; label: string } {
  const label = (value ?? '').trim().replace(/\s+/g, ' ');
  if (!label) return { key: fallback.toLowerCase(), label: fallback };
  return { key: label.toLowerCase(), label };
}

/** Counts and average stars per role or company, most reviews first. */
export function groupReviews(
  rows: readonly ReviewStatRow[],
  by: 'role' | 'company',
  limit = 8,
): GroupStat[] {
  const fallback = by === 'role' ? 'Not given' : 'Unknown';
  const groups = new Map<string, { label: string; count: number; sum: number; rated: number }>();
  for (const row of rows) {
    const { key, label } = groupKey(row[by], fallback);
    const group = groups.get(key) ?? { label, count: 0, sum: 0, rated: 0 };
    group.count += 1;
    if (row.rating !== null) {
      group.sum += row.rating;
      group.rated += 1;
    }
    groups.set(key, group);
  }
  return [...groups.values()]
    .map((group) => ({
      label: group.label,
      count: group.count,
      rated: group.rated,
      average: group.rated > 0 ? round1(group.sum / group.rated) : null,
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, limit);
}

export interface MonthPoint {
  /** `YYYY-MM`. */
  month: string;
  label: string;
  count: number;
}

/** The last `months` calendar months ending at `now` (UTC), filled with zero where absent. */
export function fillMonths(
  counts: ReadonlyMap<string, number>,
  now: Date,
  months = 6,
): MonthPoint[] {
  const points: MonthPoint[] = [];
  for (let offset = months - 1; offset >= 0; offset -= 1) {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offset, 1));
    const month = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
    points.push({
      month,
      label: date.toLocaleString('en-AU', { month: 'short', timeZone: 'UTC' }),
      count: counts.get(month) ?? 0,
    });
  }
  return points;
}
