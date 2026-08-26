import type { Tone } from "@/lib/colors";
import { cn } from "@/lib/cn";
import { TONE_DOT_CLASS } from "@/components/ui/tone";

// The product's signature motif: customer health rendered as a glowing
// signal rather than a flat chip, at three densities — a table row is a
// dot, a card is a ring, a detail header is a halo. Same tone map
// (components/ui/tone.ts) everywhere so a color always means the same
// thing across the app.
const SIZE_CLASS: Record<"sm" | "md" | "lg", string> = {
  sm: "h-2 w-2",
  md: "h-2.5 w-2.5",
  lg: "h-3.5 w-3.5",
};

export default function HealthDot({
  tone,
  size = "sm",
  className,
}: {
  tone: Tone;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn("inline-block shrink-0 rounded-full", SIZE_CLASS[size], TONE_DOT_CLASS[tone], className)}
    />
  );
}
