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
    <form onSubmit={handleSubmit(submit)} className="flex flex-col gap-3">
      <div>
        <label className="text-sm text-gray-600">Customer</label>
        {fixedCustomerId ? (
          <p className="mt-1 rounded border bg-gray-50 px-3 py-2 text-sm">
            {fixedCustomer ? `${fixedCustomer.name} (${fixedCustomer.company})` : fixedCustomerId}
          </p>
        ) : (
          <>
            <select
              className="mt-1 w-full rounded border px-3 py-2"
              {...register("customer_id")}
            >
              <option value="">Select a customer…</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.company})
                </option>
              ))}
            </select>
            {errors.customer_id && (
              <p className="mt-1 text-sm text-red-600">{errors.customer_id.message}</p>
            )}
          </>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm text-gray-600" htmlFor="type">
            Type
          </label>
          <select id="type" className="mt-1 w-full rounded border px-3 py-2" {...register("type")}>
            {interactionTypes.map((t) => (
              <option key={t} value={t}>
                {t.replace("_", " ")}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-sm text-gray-600" htmlFor="occurred_at">
            Occurred at
          </label>
          <input
            id="occurred_at"
            type="datetime-local"
            className="mt-1 w-full rounded border px-3 py-2"
            {...register("occurred_at")}
          />
          {errors.occurred_at && (
            <p className="mt-1 text-sm text-red-600">{errors.occurred_at.message}</p>
          )}
        </div>
      </div>

      <div>
        <label className="text-sm text-gray-600" htmlFor="title">
          Title
        </label>
        <input id="title" className="mt-1 w-full rounded border px-3 py-2" {...register("title")} />
        {errors.title && <p className="mt-1 text-sm text-red-600">{errors.title.message}</p>}
      </div>

      <div>
        <label className="text-sm text-gray-600" htmlFor="duration_minutes">
          Duration (minutes, optional)
        </label>
        <input
          id="duration_minutes"
          type="number"
          min={0}
          max={1440}
          className="mt-1 w-full rounded border px-3 py-2"
          {...register("duration_minutes")}
        />
        {errors.duration_minutes && (
          <p className="mt-1 text-sm text-red-600">{errors.duration_minutes.message}</p>
        )}
      </div>

      <div>
        <label className="text-sm text-gray-600" htmlFor="notes">
          Notes
        </label>
        <textarea
          id="notes"
          rows={6}
          className="mt-1 w-full rounded border px-3 py-2"
          placeholder="Meeting notes — at least 20 characters, used as the AI insight input."
          {...register("notes")}
        />
        {errors.notes && <p className="mt-1 text-sm text-red-600">{errors.notes.message}</p>}
      </div>

      {errors.root && <p className="text-sm text-red-600">{errors.root.message}</p>}

      <button
        type="submit"
        className="mt-2 rounded bg-black px-3 py-2 text-white disabled:opacity-50"
        disabled={isSubmitting}
      >
        {isSubmitting ? "Saving…" : submitLabel}
      </button>
    </form>
  );
}
