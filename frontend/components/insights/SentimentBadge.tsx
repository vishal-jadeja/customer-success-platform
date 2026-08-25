import { SENTIMENT_BADGE_CLASS, SENTIMENT_LABEL } from "@/lib/colors";
import type { SentimentValue } from "@/schemas/interaction";

const SIZE_CLASS: Record<"sm" | "md", string> = {
  sm: "text-xs px-2 py-0.5",
  md: "text-sm px-2.5 py-1",
};

/**
 * The one place in the app that renders a sentiment chip. Returns null for a
 * missing sentiment so callers never need a wrapping conditional — a caller
 * that must show something for "no sentiment yet" branches on
 * `insight.status` instead (e.g. InteractionList's Insight cell).
 */
export default function SentimentBadge({
  sentiment,
  size = "sm",
  className,
}: {
  sentiment: SentimentValue | null | undefined;
  size?: "sm" | "md";
  className?: string;
}) {
  if (!sentiment) return null;
  return (
    <span
      className={`inline-flex items-center rounded font-medium ${SENTIMENT_BADGE_CLASS[sentiment]} ${SIZE_CLASS[size]} ${className ?? ""}`}
    >
      {SENTIMENT_LABEL[sentiment]}
    </span>
  );
}
