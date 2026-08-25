import Link from "next/link";

import { CUSTOMER_STATUS_BADGE_CLASS } from "@/lib/colors";
import { formatCurrency } from "@/lib/format";
import type { AtRiskCustomer } from "@/store/slices/dashboardSlice";

/**
 * Presentational only. Note: the backend orders by health_score ASC with NO
 * status filter (see dashboardSlice.ts's AtRiskCustomer comment) — this can
 * include active/onboarding customers, so each row shows its real status
 * chip rather than implying every row is formally "at risk".
 */
export default function AtRiskList({ customers }: { customers: AtRiskCustomer[] }) {
  return (
    <ul className="divide-y">
      {customers.map((c) => (
        <li key={c.id}>
          <Link
            href={`/customers/${c.id}`}
            className="flex items-center justify-between gap-3 py-2 text-sm hover:bg-gray-50"
          >
            <div className="min-w-0">
              <p className="truncate font-medium">{c.name}</p>
              <p className="truncate text-xs text-gray-500">{c.company}</p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <span
                className={`rounded px-2 py-0.5 text-xs ${CUSTOMER_STATUS_BADGE_CLASS[c.status]}`}
              >
                {c.status}
              </span>
              <span className="w-10 text-right tabular-nums">{c.health_score}</span>
              <span className="w-20 text-right tabular-nums text-gray-500">
                {formatCurrency(c.arr)}
              </span>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
