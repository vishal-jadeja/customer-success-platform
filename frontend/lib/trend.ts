import type { SentimentTrendPoint } from "@/store/slices/dashboardSlice";

export interface TrendRow {
  date: string;
  positive: number;
  neutral: number;
  negative: number;
}

const DAY_MS = 86_400_000;

/**
 * GET /dashboard/sentiment-trend returns only days that had a non-null-
 * sentiment insight — no zero-filled gap days, so a 30-day request can come
 * back with 4 unevenly-spaced points. This builds a continuous, zero-filled
 * series so the chart's x-axis reflects real elapsed time.
 */
export function buildTrendSeries(
  points: SentimentTrendPoint[],
  days: number,
  now: Date = new Date(),
): TrendRow[] {
  const safePoints = Array.isArray(points) ? points : [];
  if (safePoints.length === 0) return [];

  const byDate = new Map<string, SentimentTrendPoint>();
  for (const p of safePoints) byDate.set(p.date, p);

  // Generate the window in UTC — the backend buckets with
  // date_trunc('day', occurred_at) on UTC timestamps, so a local-time window
  // would be off by one day for anyone west of Greenwich.
  const endMs = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const windowKeys = new Set<string>();
  for (let i = days - 1; i >= 0; i--) {
    windowKeys.add(new Date(endMs - i * DAY_MS).toISOString().slice(0, 10));
  }

  // Union with every key actually present in the response — the backend's
  // `occurred_at >= now - timedelta(days)` filter can include part of a
  // boundary day the generated window misses, and clocks can differ.
  for (const key of byDate.keys()) windowKeys.add(key);

  return Array.from(windowKeys)
    .sort() // ISO "YYYY-MM-DD" sorts lexicographically == chronologically
    .map((date) => ({
      date,
      positive: 0,
      neutral: 0,
      negative: 0,
      ...byDate.get(date),
    }));
}
