import type { Tone } from "@/lib/colors";

// Shared Tailwind class maps for anything that renders a `Tone` — Badge,
// HealthDot, form banners. Kept separate from lib/colors.ts because that
// file is enum→Tone; this one is Tone→Tailwind classes.
export const TONE_CHIP_CLASS: Record<Tone, string> = {
  good: "bg-good-soft text-good border-good/25",
  warn: "bg-warn-soft text-warn border-warn/25",
  bad: "bg-bad-soft text-bad border-bad/25",
  info: "bg-info-soft text-info border-info/25",
  neutral: "bg-panel-strong text-text-secondary border-hairline-strong",
  accent: "bg-accent-soft text-accent border-accent/25",
};

export const TONE_DOT_CLASS: Record<Tone, string> = {
  good: "bg-good shadow-[0_0_10px_var(--color-good)]",
  warn: "bg-warn shadow-[0_0_10px_var(--color-warn)]",
  bad: "bg-bad shadow-[0_0_10px_var(--color-bad)]",
  info: "bg-info shadow-[0_0_10px_var(--color-info)]",
  neutral: "bg-text-muted",
  accent: "bg-accent shadow-[0_0_10px_var(--color-accent)]",
};
