"use client";

import Filters, { FilterField } from "@/components/common/Filters";
import { useCustomerOptions } from "@/lib/useCustomerOptions";
import { interactionTypes, sentiments } from "@/schemas/interaction";
import type { InteractionListParams } from "@/store/slices/interactionsSlice";

/**
 * Mirrors backend filter params exactly: customer_id, type, sentiment,
 * date_from, date_to (see app/api/v1/routers/interactions.py::list_interactions).
 * `q` also exists on the backend but isn't in the Phase 09 plan's filter
 * list, so it's left out here.
 */
export default function InteractionFilters({
  value,
  onChange,
  onApply,
}: {
  value: InteractionListParams;
  onChange: (value: InteractionListParams) => void;
  onApply: () => void;
}) {
  const customers = useCustomerOptions();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onApply();
      }}
    >
      <Filters>
        <FilterField label="Customer">
          <select
            className="rounded border px-2 py-1"
            value={value.customer_id ?? ""}
            onChange={(e) => onChange({ ...value, customer_id: e.target.value || undefined })}
          >
            <option value="">Any</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.company})
              </option>
            ))}
          </select>
        </FilterField>
        <FilterField label="Type">
          <select
            className="rounded border px-2 py-1"
            value={value.type ?? ""}
            onChange={(e) =>
              onChange({ ...value, type: e.target.value as InteractionListParams["type"] })
            }
          >
            <option value="">Any</option>
            {interactionTypes.map((t) => (
              <option key={t} value={t}>
                {t.replace("_", " ")}
              </option>
            ))}
          </select>
        </FilterField>
        <FilterField label="Sentiment">
          <select
            className="rounded border px-2 py-1"
            value={value.sentiment ?? ""}
            onChange={(e) =>
              onChange({ ...value, sentiment: e.target.value as InteractionListParams["sentiment"] })
            }
          >
            <option value="">Any</option>
            {sentiments.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </FilterField>
        <FilterField label="From">
          <input
            type="date"
            className="rounded border px-2 py-1"
            value={value.date_from ?? ""}
            onChange={(e) => onChange({ ...value, date_from: e.target.value || undefined })}
          />
        </FilterField>
        <FilterField label="To">
          <input
            type="date"
            className="rounded border px-2 py-1"
            value={value.date_to ?? ""}
            onChange={(e) => onChange({ ...value, date_to: e.target.value || undefined })}
          />
        </FilterField>
        <button type="submit" className="rounded bg-black px-3 py-1.5 text-sm text-white">
          Apply
        </button>
      </Filters>
    </form>
  );
}
