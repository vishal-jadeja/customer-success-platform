"use client";

import { useRouter } from "next/navigation";
import { Fragment, useState } from "react";

import InsightPanel from "@/components/insights/InsightPanel";
import SentimentBadge from "@/components/insights/SentimentBadge";
import type { Interaction } from "@/store/slices/interactionsSlice";

export default function InteractionList({
  interactions,
  expandableInsights = false,
}: {
  interactions: Interaction[];
  /** Adds a per-row toggle that expands a compact InsightPanel inline.
   * Defaults to false so /interactions keeps its exact Phase 09 behaviour;
   * only the customer detail page opts in. */
  expandableInsights?: boolean;
}) {
  const router = useRouter();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  if (interactions.length === 0) {
    return <p className="p-6 text-center text-sm text-gray-500">No interactions found.</p>;
  }

  function toggle(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b text-gray-500">
            <th className="py-2 pr-4">Title</th>
            <th className="py-2 pr-4">Type</th>
            <th className="py-2 pr-4">Occurred</th>
            <th className="py-2 pr-4">Insight</th>
            {expandableInsights && <th className="py-2 pr-4" />}
          </tr>
        </thead>
        <tbody>
          {interactions.map((i) => {
            // A failed insight is never hidden behind an undiscovered
            // toggle — it starts expanded so "never blank, always shows
            // error_message + Retry" holds here too.
            const isExpanded = expanded.has(i.id) || i.insight?.status === "failed";
            return (
              <Fragment key={i.id}>
                <tr
                  className="cursor-pointer border-b hover:bg-gray-50"
                  onClick={() => router.push(`/interactions/${i.id}`)}
                >
                  <td className="py-2 pr-4 font-medium">{i.title}</td>
                  <td className="py-2 pr-4 capitalize">{i.type.replace("_", " ")}</td>
                  <td className="py-2 pr-4">{new Date(i.occurred_at).toLocaleString()}</td>
                  <td className="py-2 pr-4">
                    {i.insight?.status === "completed" && i.insight.sentiment ? (
                      <SentimentBadge sentiment={i.insight.sentiment} />
                    ) : i.insight?.status === "failed" ? (
                      <span className="text-xs text-red-600">Failed</span>
                    ) : (
                      <span className="text-xs text-gray-400">Pending…</span>
                    )}
                  </td>
                  {expandableInsights && (
                    <td className="py-2 pr-4">
                      <button
                        type="button"
                        onClick={(e) => toggle(i.id, e)}
                        className="rounded border px-2 py-0.5 text-xs hover:bg-gray-50"
                      >
                        {isExpanded ? "Hide insight" : "Insight"}
                      </button>
                    </td>
                  )}
                </tr>
                {expandableInsights && isExpanded && (
                  <tr className="border-b bg-gray-50/50">
                    <td colSpan={5} className="p-3">
                      <InsightPanel interaction={i} variant="compact" />
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
