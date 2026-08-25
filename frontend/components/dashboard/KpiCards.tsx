import SentimentBadge from "@/components/insights/SentimentBadge";
import { formatCount, formatCurrency, formatHealth } from "@/lib/format";
import { sentiments } from "@/schemas/interaction";
import type { DashboardSummary } from "@/store/slices/dashboardSlice";

function Tile({
  label,
  value,
  sublabel,
}: {
  label: string;
  value: string;
  sublabel?: string;
}) {
  return (
    <div className="rounded border p-4">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
      {sublabel && <p className="text-xs text-gray-400">{sublabel}</p>}
    </div>
  );
}

/** Presentational only — takes an already-loaded summary, fetches nothing. */
export default function KpiCards({ summary }: { summary: DashboardSummary }) {
  const hasCustomers = summary.total_customers > 0;
  const atRiskCount = summary.by_status.at_risk ?? 0;

  return (
    <div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Tile label="Customers" value={formatCount(summary.total_customers)} />
        <Tile label="Total ARR" value={formatCurrency(summary.total_arr)} />
        <Tile
          label="Avg health"
          value={formatHealth(summary.avg_health_score, hasCustomers)}
          sublabel="out of 100"
        />
        <Tile
          label="At risk"
          value={formatCount(atRiskCount)}
          sublabel={`of ${formatCount(summary.total_customers)} customers`}
        />
        <Tile
          label="Interactions"
          value={formatCount(summary.interactions_last_30d)}
          sublabel="last 30 days"
        />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-gray-500">
        <span>Sentiment across all insights:</span>
        {sentiments.map((s) => (
          <span key={s} className="flex items-center gap-1">
            <SentimentBadge sentiment={s} />
            {formatCount(summary.sentiment_breakdown[s] ?? 0)}
          </span>
        ))}
      </div>
    </div>
  );
}
