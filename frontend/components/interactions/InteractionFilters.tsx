"use client";

import Filters, { FilterField } from "@/components/common/Filters";
import { useCustomerOptions } from "@/lib/useCustomerOptions";
import { interactionTypes, sentiments } from "@/schemas/interaction";
import type { InteractionListParams } from "@/store/slices/interactionsSlice";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";

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
          <Select
            value={value.customer_id ?? ""}
            onChange={(e) => onChange({ ...value, customer_id: e.target.value || undefined })}
          >
            <option value="">Any</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.company})
              </option>
            ))}
          </Select>
        </FilterField>
        <FilterField label="Type">
          <Select
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
          </Select>
        </FilterField>
        <FilterField label="Sentiment">
          <Select
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
          </Select>
        </FilterField>
        <FilterField label="From">
          <Input
            type="date"
            value={value.date_from ?? ""}
            onChange={(e) => onChange({ ...value, date_from: e.target.value || undefined })}
          />
        </FilterField>
        <FilterField label="To">
          <Input
            type="date"
            value={value.date_to ?? ""}
            onChange={(e) => onChange({ ...value, date_to: e.target.value || undefined })}
          />
        </FilterField>
        <Button type="submit" size="sm">
          Apply
        </Button>
      </Filters>
    </form>
  );
}
