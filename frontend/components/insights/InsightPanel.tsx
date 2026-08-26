"use client";

import { ListChecks, Loader2, RotateCw, ShieldAlert, Sparkles, TriangleAlert } from "lucide-react";

import SentimentBadge from "@/components/insights/SentimentBadge";
import Button from "@/components/ui/Button";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { regenerateInsight, type Interaction } from "@/store/slices/interactionsSlice";
import { cn } from "@/lib/cn";

/**
 * The AI insight state machine: pending/completed/failed/null, the Retry
 * dispatch, its per-id in-flight state, and the two distinct failure
 * surfaces (a fulfilled "status: failed" insight vs. a rejected transport
 * error). One component, two chrome variants — the state machine is the
 * hard part and must not exist in two copies that can drift.
 */
export default function InsightPanel({
  interaction,
  variant = "full",
  className,
}: {
  interaction: Interaction;
  variant?: "full" | "compact";
  className?: string;
}) {
  const dispatch = useAppDispatch();
  const isRegenerating = useAppSelector((state) =>
    state.interactions.regeneratingIds.includes(interaction.id),
  );
  const regenerateError = useAppSelector(
    (state) => state.interactions.regenerateErrors[interaction.id],
  );
  const insight = interaction.insight;

  function handleRetry(e: React.MouseEvent) {
    // Guards against firing the parent row's router.push when this panel is
    // mounted inside a clickable <tr> (InteractionList's compact mode).
    e.stopPropagation();
    dispatch(regenerateInsight(interaction.id));
  }

  const retryButton = (
    <Button variant="secondary" size="sm" onClick={handleRetry} loading={isRegenerating}>
      {!isRegenerating && <RotateCw className="h-3.5 w-3.5" />}
      {isRegenerating ? "Regenerating…" : "Retry"}
    </Button>
  );

  const transportError = regenerateError && (
    <p className="mt-2 text-xs text-bad">
      {regenerateError.message}
      {regenerateError.code === "TIMEOUT" &&
        " Generation may still have finished — reload to check."}
    </p>
  );

  const heading = variant === "full" && (
    <h2 className="flex items-center gap-1.5 text-sm font-semibold text-text-secondary">
      <Sparkles className="h-3.5 w-3.5 text-accent" />
      AI insight
    </h2>
  );

  // A row always gets an insight row committed with it (Phase 05/06) — null
  // is defensive only. Render it the same as pending rather than a distinct
  // "no insight" state.
  if (!insight || insight.status === "pending") {
    return (
      <div className={cn("rounded-xl border border-accent/20 bg-accent-soft p-4", className)}>
        {heading}
        <p className="mt-2 flex items-center gap-2 text-sm text-text-secondary">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-accent" />
          Generating…
        </p>
      </div>
    );
  }

  if (insight.status === "failed") {
    return (
      <div className={cn("rounded-xl border border-warn/25 bg-warn-soft p-4", className)}>
        {heading}
        <p className="mt-2 flex items-start gap-2 text-sm text-warn">
          <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {insight.error_message ?? "Generation failed."}
        </p>
        <div className="mt-3">{retryButton}</div>
        {transportError}
      </div>
    );
  }

  // completed
  return (
    <div className={cn("rounded-xl border border-hairline bg-panel p-4", className)}>
      <div className="flex items-center justify-between">
        {heading}
        {variant === "full" && retryButton}
      </div>
      <div className="mt-2 space-y-3 text-sm text-text">
        <SentimentBadge sentiment={insight.sentiment} size="md" />
        <p className={cn("text-text-secondary", variant === "compact" && "line-clamp-2")}>
          {insight.summary}
        </p>

        <div>
          <p className="flex items-center gap-1.5 font-medium text-text">
            <ListChecks className="h-3.5 w-3.5 text-text-muted" />
            Action items
          </p>
          {insight.action_items.length > 0 ? (
            <ul className="mt-1 list-inside list-disc text-text-secondary marker:text-text-muted">
              {insight.action_items.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-text-muted">No action items suggested.</p>
          )}
        </div>

        <div>
          <p className="flex items-center gap-1.5 font-medium text-text">
            <ShieldAlert className="h-3.5 w-3.5 text-text-muted" />
            Key risks
          </p>
          {insight.risks.length > 0 ? (
            <ul className="mt-1 list-inside list-disc text-text-secondary marker:text-text-muted">
              {insight.risks.map((risk, i) => (
                <li key={i}>{risk}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-text-muted">No risks identified.</p>
          )}
        </div>

        {variant === "full" && (
          <p className="font-mono text-xs text-text-muted">
            {[
              insight.provider,
              insight.model,
              insight.latency_ms != null ? `${insight.latency_ms} ms` : null,
              `attempt ${insight.attempts}`,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        )}
      </div>
      {variant === "compact" && <div className="mt-3">{retryButton}</div>}
      {transportError}
    </div>
  );
}
