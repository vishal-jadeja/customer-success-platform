import { SENTIMENT_LABEL, SENTIMENT_TONE } from "@/lib/colors";
import type { SentimentValue } from "@/schemas/interaction";
import Badge from "@/components/ui/Badge";

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
    <Badge tone={SENTIMENT_TONE[sentiment]} size={size} className={className}>
      {SENTIMENT_LABEL[sentiment]}
    </Badge>
  );
}
