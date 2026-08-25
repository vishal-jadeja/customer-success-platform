import { z } from "zod";

// Mirrors backend/app/models/enums.py::CustomerStatus
export const customerStatuses = ["onboarding", "active", "at_risk", "churned"] as const;
export type CustomerStatusValue = (typeof customerStatuses)[number];

export const customerSorts = ["created_at", "name", "health_score", "arr"] as const;
export type CustomerSortValue = (typeof customerSorts)[number];

// Mirrors backend/app/schemas/customer.py::CustomerBase/CustomerCreate. `arr`
// is a Decimal on the backend (serialized as a JSON string, see
// app/schemas/customer.py::CustomerBase.arr) — the form keeps it a string
// and only shapes it (ge 0, <=2 decimal places) rather than coercing to
// number, so "12.5" round-trips without float rounding surprises.
export const customerFormSchema = z.object({
  name: z.string().min(1).max(160),
  company: z.string().min(1).max(160),
  email: z.email(),
  phone: z.string().max(32).optional().or(z.literal("")),
  industry: z.string().max(80).optional().or(z.literal("")),
  status: z.enum(customerStatuses),
  health_score: z.coerce.number().int().min(0).max(100),
  arr: z
    .string()
    .regex(/^\d{1,10}(\.\d{1,2})?$/, "Enter a number with up to 2 decimal places")
    .optional()
    .or(z.literal("")),
  // Only rendered for admin/manager; a csm never sees this field, so the
  // backend's forced-self-ownership rule is never exercised through it.
  owner_id: z.uuid().optional().or(z.literal("")),
});
// Output (post-coercion, e.g. health_score: number) vs. input (pre-coercion,
// what raw <input> values look like) — z.coerce fields make these diverge,
// so useForm is typed with both (see CustomerForm.tsx).
export type CustomerFormInput = z.infer<typeof customerFormSchema>;
export type CustomerFormRawInput = z.input<typeof customerFormSchema>;
