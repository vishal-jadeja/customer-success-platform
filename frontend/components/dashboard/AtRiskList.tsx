import Link from "next/link";

import { CUSTOMER_STATUS_LABEL, CUSTOMER_STATUS_TONE } from "@/lib/colors";
import { formatCurrency } from "@/lib/format";
import type { AtRiskCustomer } from "@/store/slices/dashboardSlice";
import Badge from "@/components/ui/Badge";
import HealthDot from "@/components/ui/HealthDot";

/**
 * Presentational only. Note: the backend orders by health_score ASC with NO
 * status filter (see dashboardSlice.ts's AtRiskCustomer comment) — this can
 * include active/onboarding customers, so each row shows its real status
 * chip rather than implying every row is formally "at risk".
 */
export default function AtRiskList({ customers }: { customers: AtRiskCustomer[] }) {
  return (
    <ul className="divide-y divide-hairline">
      {customers.map((c) => (
        <li key={c.id}>
          <Link
            href={`/customers/${c.id}`}
            className="flex items-center justify-between gap-3 rounded-lg px-2 py-2.5 text-sm transition-colors hover:bg-panel-strong"
          >
            <div className="flex min-w-0 items-center gap-3">
              <HealthDot tone={CUSTOMER_STATUS_TONE[c.status]} size="md" />
              <div className="min-w-0">
                <p className="truncate font-medium text-text">{c.name}</p>
                <p className="truncate text-xs text-text-muted">{c.company}</p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <Badge tone={CUSTOMER_STATUS_TONE[c.status]}>{CUSTOMER_STATUS_LABEL[c.status]}</Badge>
              <span className="w-8 text-right font-mono text-text-secondary tabular-nums">
                {c.health_score}
              </span>
              <span className="w-20 text-right font-mono text-text-muted tabular-nums">
                {formatCurrency(c.arr)}
              </span>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
