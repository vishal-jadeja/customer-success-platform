"use client";

import { useRouter } from "next/navigation";
import { Fragment, useState } from "react";
import { ChevronDown, MessageSquare } from "lucide-react";

import InsightPanel from "@/components/insights/InsightPanel";
import SentimentBadge from "@/components/insights/SentimentBadge";
import type { Interaction } from "@/store/slices/interactionsSlice";
import EmptyState from "@/components/ui/EmptyState";
import { Table, TBody, TCell, TH, THead, TRow } from "@/components/ui/Table";
import { cn } from "@/lib/cn";

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
    return (
      <div className="rounded-2xl border border-hairline bg-panel backdrop-blur-xl">
        <EmptyState icon={MessageSquare} title="No interactions found" />
      </div>
    );
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
    <Table>
      <THead>
        <TH>Title</TH>
        <TH>Type</TH>
        <TH>Occurred</TH>
        <TH>Insight</TH>
        {expandableInsights && <TH />}
      </THead>
      <TBody>
        {interactions.map((i) => {
          // A failed insight is never hidden behind an undiscovered
          // toggle — it starts expanded so "never blank, always shows
          // error_message + Retry" holds here too.
          const isExpanded = expanded.has(i.id) || i.insight?.status === "failed";
          return (
            <Fragment key={i.id}>
              <TRow onClick={() => router.push(`/interactions/${i.id}`)}>
                <TCell className="font-medium">{i.title}</TCell>
                <TCell className="text-text-secondary capitalize">{i.type.replace("_", " ")}</TCell>
                <TCell className="text-text-secondary">
                  {new Date(i.occurred_at).toLocaleString()}
                </TCell>
                <TCell>
                  {i.insight?.status === "completed" && i.insight.sentiment ? (
                    <SentimentBadge sentiment={i.insight.sentiment} />
                  ) : i.insight?.status === "failed" ? (
                    <span className="text-xs text-warn">Failed</span>
                  ) : (
                    <span className="text-xs text-text-muted">Pending…</span>
                  )}
                </TCell>
                {expandableInsights && (
                  <TCell>
                    <button
                      type="button"
                      onClick={(e) => toggle(i.id, e)}
                      className="inline-flex items-center gap-1 rounded-lg border border-hairline-strong px-2 py-1 text-xs text-text-secondary hover:bg-panel-strong"
                    >
                      <ChevronDown className={cn("h-3 w-3 transition-transform", isExpanded && "rotate-180")} />
                      {isExpanded ? "Hide" : "Insight"}
                    </button>
                  </TCell>
                )}
              </TRow>
              {expandableInsights && isExpanded && (
                <tr className="border-b border-hairline bg-canvas/40">
                  <td colSpan={5} className="p-3">
                    <InsightPanel interaction={i} variant="compact" />
                  </td>
                </tr>
              )}
            </Fragment>
          );
        })}
      </TBody>
    </Table>
  );
}
