import { Activity, MessagesSquare, TriangleAlert, Users2, Wallet } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import SentimentBadge from "@/components/insights/SentimentBadge";
import { formatCount, formatCurrency, formatHealth } from "@/lib/format";
import { sentiments } from "@/schemas/interaction";
import type { DashboardSummary } from "@/store/slices/dashboardSlice";
import { cn } from "@/lib/cn";

function Tile({
  icon: Icon,
  label,
  value,
  sublabel,
  warn = false,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  sublabel?: string;
  warn?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border p-4",
        warn ? "border-warn/20 bg-warn-soft" : "border-hairline bg-panel-strong",
      )}
    >
      <div className="flex items-center justify-between">
        <p className="text-xs text-text-muted">{label}</p>
        <Icon className={cn("h-3.5 w-3.5", warn ? "text-warn" : "text-text-muted")} />
      </div>
      <p className="mt-1.5 font-mono text-2xl font-semibold tracking-tight text-text tabular-nums">
        {value}
      </p>
      {sublabel && <p className="mt-0.5 text-xs text-text-muted">{sublabel}</p>}
    </div>
  );
}

/** Presentational only — takes an already-loaded summary, fetches nothing. */
export default function KpiCards({ summary }: { summary: DashboardSummary }) {
  const hasCustomers = summary.total_customers > 0;
  const atRiskCount = summary.by_status.at_risk ?? 0;

  return (
    <div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Tile icon={Users2} label="Customers" value={formatCount(summary.total_customers)} />
        <Tile icon={Wallet} label="Total ARR" value={formatCurrency(summary.total_arr)} />
        <Tile
          icon={Activity}
          label="Avg health"
          value={formatHealth(summary.avg_health_score, hasCustomers)}
          sublabel="out of 100"
        />
        <Tile
          icon={TriangleAlert}
          label="At risk"
          value={formatCount(atRiskCount)}
          sublabel={`of ${formatCount(summary.total_customers)} customers`}
          warn={atRiskCount > 0}
        />
        <Tile
          icon={MessagesSquare}
          label="Interactions"
          value={formatCount(summary.interactions_last_30d)}
          sublabel="last 30 days"
        />
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-text-muted">
        <span>Sentiment across all insights:</span>
        {sentiments.map((s) => (
          <span key={s} className="flex items-center gap-1.5">
            <SentimentBadge sentiment={s} />
            <span className="font-mono tabular-nums">
              {formatCount(summary.sentiment_breakdown[s] ?? 0)}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
