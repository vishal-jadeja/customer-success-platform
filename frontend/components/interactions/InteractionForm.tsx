"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { fieldErrorsFromDetails, type ApiError } from "@/lib/errors";
import { useCustomerOptions } from "@/lib/useCustomerOptions";
import {
  interactionFormSchema,
  interactionTypes,
  type InteractionFormInput,
  type InteractionFormRawInput,
} from "@/schemas/interaction";
import type { InteractionFormPayload } from "@/store/slices/interactionsSlice";
import Button from "@/components/ui/Button";
import Field from "@/components/ui/Field";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Textarea from "@/components/ui/Textarea";

// <input type="datetime-local"> <-> ISO instant. datetime-local has no
// timezone, so this reads/writes it in the browser's local time — good
// enough for a single-tenant internal tool with no cross-timezone need.
function toDatetimeLocal(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function InteractionForm({
  fixedCustomerId,
  initial,
  onSubmit,
  submitLabel,
}: {
  /** Set when the customer is fixed (create preselected via ?customer_id=, or any edit — the backend's InteractionUpdate has no customer_id field). */
  fixedCustomerId?: string;
  /** Existing interaction fields when editing (occurredAtIso as a raw ISO instant). */
  initial?: {
    type: InteractionFormInput["type"];
    title: string;
    notes: string;
    occurredAtIso: string;
    duration_minutes: number | null;
  };
  onSubmit: (data: InteractionFormPayload) => Promise<ApiError | null>;
  submitLabel: string;
}) {
  const customers = useCustomerOptions();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<InteractionFormRawInput, unknown, InteractionFormInput>({
    resolver: zodResolver(interactionFormSchema),
    defaultValues: {
      customer_id: fixedCustomerId ?? "",
      type: initial?.type ?? "meeting",
      title: initial?.title ?? "",
      notes: initial?.notes ?? "",
      occurred_at: initial ? toDatetimeLocal(initial.occurredAtIso) : "",
      duration_minutes: initial?.duration_minutes ?? undefined,
    },
  });

  const fixedCustomer = customers.find((c) => c.id === fixedCustomerId);

  async function submit(data: InteractionFormInput) {
    const payload: InteractionFormPayload = {
      customer_id: fixedCustomerId ?? data.customer_id,
      type: data.type,
      title: data.title,
      notes: data.notes,
      occurred_at: new Date(data.occurred_at).toISOString(),
      duration_minutes: data.duration_minutes ?? null,
    };

    const apiError = await onSubmit(payload);
    if (!apiError) return;

    if (apiError.code === "VALIDATION_ERROR") {
      const fieldErrors = fieldErrorsFromDetails(apiError.details);
      for (const [field, message] of Object.entries(fieldErrors)) {
        if (field in data) setError(field as keyof InteractionFormInput, { message });
      }
      if (Object.keys(fieldErrors).length === 0) {
        setError("root", { message: apiError.message });
      }
      return;
    }
    if (apiError.code === "PERMISSION_DENIED") {
      setError("root", { message: "You don't have access to do that." });
      return;
    }
    setError("root", { message: apiError.message });
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="flex flex-col gap-4">
      <Field label="Customer" error={fixedCustomerId ? undefined : errors.customer_id?.message}>
        {fixedCustomerId ? (
          <p className="rounded-lg border border-hairline-strong bg-panel-strong px-3 py-2 text-sm text-text-secondary">
            {fixedCustomer ? `${fixedCustomer.name} (${fixedCustomer.company})` : fixedCustomerId}
          </p>
        ) : (
          <Select {...register("customer_id")}>
            <option value="">Select a customer…</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.company})
              </option>
            ))}
          </Select>
        )}
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Type" htmlFor="type">
          <Select id="type" {...register("type")}>
            {interactionTypes.map((t) => (
              <option key={t} value={t}>
                {t.replace("_", " ")}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Occurred at" htmlFor="occurred_at" error={errors.occurred_at?.message}>
          <Input id="occurred_at" type="datetime-local" {...register("occurred_at")} />
        </Field>
      </div>

      <Field label="Title" htmlFor="title" error={errors.title?.message}>
        <Input id="title" {...register("title")} />
      </Field>

      <Field
        label="Duration (minutes, optional)"
        htmlFor="duration_minutes"
        error={errors.duration_minutes?.message}
      >
        <Input id="duration_minutes" type="number" min={0} max={1440} {...register("duration_minutes")} />
      </Field>

      <Field label="Notes" htmlFor="notes" error={errors.notes?.message}>
        <Textarea
          id="notes"
          rows={6}
          placeholder="Meeting notes — at least 20 characters, used as the AI insight input."
          {...register("notes")}
        />
      </Field>

      {errors.root && <p className="text-sm text-bad">{errors.root.message}</p>}

      <Button type="submit" loading={isSubmitting} className="mt-1 self-start">
        {isSubmitting ? "Saving…" : submitLabel}
      </Button>
    </form>
  );
}
