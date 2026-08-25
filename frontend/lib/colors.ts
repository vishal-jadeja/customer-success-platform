import type { CustomerStatusValue } from "@/schemas/customer";
import type { SentimentValue } from "@/schemas/interaction";

/**
 * Single source of truth for every enum→colour mapping in the app. Recharts
 * needs literal hex (it cannot consume Tailwind classes), so the badge's
 * Tailwind classes and the chart's hex both read from here — one place to
 * change green, instead of three copies quietly drifting apart.
 */
export const SENTIMENT_BADGE_CLASS: Record<SentimentValue, string> = {
  positive: "bg-green-100 text-green-800",
  neutral: "bg-gray-100 text-gray-700",
  negative: "bg-red-100 text-red-800",
};

// Same palette families as the badges above, at the -600 weight Recharts
// lines read clearly at.
export const SENTIMENT_HEX: Record<SentimentValue, string> = {
  positive: "#16a34a",
  neutral: "#6b7280",
  negative: "#dc2626",
};

export const SENTIMENT_LABEL: Record<SentimentValue, string> = {
  positive: "Positive",
  neutral: "Neutral",
  negative: "Negative",
};

// Lifted verbatim from the customer list/detail pages' local STATUS_STYLES.
export const CUSTOMER_STATUS_BADGE_CLASS: Record<CustomerStatusValue, string> = {
  onboarding: "bg-blue-100 text-blue-800",
  active: "bg-green-100 text-green-800",
  at_risk: "bg-amber-100 text-amber-800",
  churned: "bg-gray-200 text-gray-600",
};
