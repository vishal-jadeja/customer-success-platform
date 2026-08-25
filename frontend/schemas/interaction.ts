import { z } from "zod";

// Mirrors backend/app/models/enums.py::InteractionType / Sentiment
export const interactionTypes = ["meeting", "call", "email", "support_ticket", "qbr"] as const;
export type InteractionTypeValue = (typeof interactionTypes)[number];

export const sentiments = ["positive", "neutral", "negative"] as const;
export type SentimentValue = (typeof sentiments)[number];

// Mirrors backend/app/schemas/interaction.py::InteractionCreate/Update.
// `occurred_at` is bound to a <input type="datetime-local"> field, which
// yields "YYYY-MM-DDTHH:mm" with no timezone — new Date(value).toISOString()
// on submit turns that into the UTC instant the backend expects.
export const interactionFormSchema = z.object({
  customer_id: z.uuid(),
  type: z.enum(interactionTypes),
  title: z.string().min(1).max(200),
  notes: z.string().min(20, "Notes must be at least 20 characters (used as AI input)"),
  occurred_at: z.string().min(1, "Required"),
  // "" (the empty <input>) must map to undefined, not be coerced to 0 — a
  // plain z.coerce.number() would coerce "" to 0 before the optional check
  // ever runs, silently turning "no duration entered" into "0 minutes".
  duration_minutes: z.preprocess(
    (v) => (v === "" || v === undefined || v === null ? undefined : Number(v)),
    z.number().int().min(0).max(1440).optional(),
  ),
});
// See schemas/customer.ts's CustomerFormRawInput comment — duration_minutes's
// preprocess step makes the raw <input> type diverge from the parsed output.
export type InteractionFormInput = z.infer<typeof interactionFormSchema>;
export type InteractionFormRawInput = z.input<typeof interactionFormSchema>;
