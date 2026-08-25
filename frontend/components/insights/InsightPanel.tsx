"use client";

import SentimentBadge from "@/components/insights/SentimentBadge";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { regenerateInsight, type Interaction } from "@/store/slices/interactionsSlice";

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
    <button
      type="button"
      onClick={handleRetry}
      disabled={isRegenerating}
      aria-busy={isRegenerating}
      className="rounded border px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50"
    >
      {isRegenerating ? "Regenerating…" : "Retry"}
    </button>
  );

  const transportError = regenerateError && (
    <p className="mt-2 text-xs text-red-600">
      {regenerateError.message}
      {regenerateError.code === "TIMEOUT" &&
        " Generation may still have finished — reload to check."}
    </p>
  );

  const heading = variant === "full" && (
    <h2 className="text-sm font-semibold text-gray-600">AI insight</h2>
  );

  // A row always gets an insight row committed with it (Phase 05/06) — null
  // is defensive only. Render it the same as pending rather than a distinct
  // "no insight" state.
  if (!insight || insight.status === "pending") {
    return (
      <div className={`rounded border p-4 ${className ?? ""}`}>
        {heading}
        <p className="mt-2 flex items-center gap-2 text-sm text-gray-500">
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" />
          Generating…
        </p>
      </div>
    );
  }

  if (insight.status === "failed") {
    return (
      <div className={`rounded border border-red-200 bg-red-50 p-4 ${className ?? ""}`}>
        {heading}
        <p className="mt-2 text-sm text-red-700">{insight.error_message ?? "Generation failed."}</p>
        <div className="mt-3">{retryButton}</div>
        {transportError}
      </div>
    );
  }

  // completed
  return (
    <div className={`rounded border p-4 ${className ?? ""}`}>
      <div className="flex items-center justify-between">
        {heading}
        {variant === "full" && retryButton}
      </div>
      <div className="mt-2 space-y-2 text-sm">
        <SentimentBadge sentiment={insight.sentiment} size="md" />
        <p className={variant === "compact" ? "line-clamp-2" : undefined}>{insight.summary}</p>

        <div>
          <p className="font-medium">Action items</p>
          {insight.action_items.length > 0 ? (
            <ul className="list-inside list-disc">
              {insight.action_items.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-400">No action items suggested.</p>
          )}
        </div>

        <div>
          <p className="font-medium">Key risks</p>
          {insight.risks.length > 0 ? (
            <ul className="list-inside list-disc">
              {insight.risks.map((risk, i) => (
                <li key={i}>{risk}</li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-400">No risks identified.</p>
          )}
        </div>

        {variant === "full" && (
          <p className="text-xs text-gray-400">
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
