import type { CustomerStatusValue } from "@/schemas/customer";
import type { SentimentValue } from "@/schemas/interaction";

/**
 * Single source of truth for every enum→colour mapping in the app. Recharts
 * needs literal hex (it cannot consume Tailwind classes), so the badge's
 * tone, the chart's hex, and the health-signal glow all read from here — one
 * place to change "good", instead of copies quietly drifting apart.
 *
 * `Tone` also drives components/ui/Badge.tsx and components/ui/HealthDot.tsx
 * via TONE_CLASS / TONE_GLOW in components/ui/tone.ts.
 */
export type Tone = "good" | "warn" | "bad" | "info" | "neutral" | "accent";

export const SENTIMENT_TONE: Record<SentimentValue, Tone> = {
  positive: "good",
  neutral: "neutral",
  negative: "bad",
};

export const SENTIMENT_LABEL: Record<SentimentValue, string> = {
  positive: "Positive",
  neutral: "Neutral",
  negative: "Negative",
};

// Dark-legible hex — matches the --color-good/warn/bad tokens in globals.css
// so Recharts lines and CSS-driven chips never drift apart.
export const SENTIMENT_HEX: Record<SentimentValue, string> = {
  positive: "#34d399",
  neutral: "#8b96ac",
  negative: "#f87171",
};

export const CUSTOMER_STATUS_TONE: Record<CustomerStatusValue, Tone> = {
  onboarding: "info",
  active: "good",
  at_risk: "warn",
  churned: "neutral",
};

export const CUSTOMER_STATUS_LABEL: Record<CustomerStatusValue, string> = {
  onboarding: "Onboarding",
  active: "Active",
  at_risk: "At risk",
  churned: "Churned",
};
