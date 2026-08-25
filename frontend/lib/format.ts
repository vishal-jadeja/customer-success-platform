/**
 * Display formatting for dashboard numbers. `total_arr`/`arr` are Decimal on
 * the backend, which Pydantic v2 serializes as a JSON string (confirmed in
 * Phase 09) — accept either shape here so a future backend change to a
 * numeric encoding doesn't silently break the UI.
 */
export function formatCurrency(value: string | number | null | undefined): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return "$0";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

export function formatCount(n: number): string {
  return n.toLocaleString();
}

// A server-side average of 0.0 for an empty book reads as "catastrophic
// health" rather than "no data" — show a dash instead when there's nothing
// to average.
export function formatHealth(score: number | null | undefined, hasCustomers: boolean): string {
  if (!hasCustomers || score == null) return "—";
  return String(Math.round(score));
}
