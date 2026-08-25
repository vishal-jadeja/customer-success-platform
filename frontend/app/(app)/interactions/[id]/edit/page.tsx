"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";

import InteractionForm from "@/components/interactions/InteractionForm";
import type { ApiError } from "@/lib/errors";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  fetchInteraction,
  updateInteraction,
  type InteractionFormPayload,
} from "@/store/slices/interactionsSlice";

export default function EditInteractionPage() {
  const { id } = useParams<{ id: string }>();
  const dispatch = useAppDispatch();
  const router = useRouter();
  const interaction = useAppSelector((state) => state.interactions.entities[id]);
  const detailStatus = useAppSelector((state) => state.interactions.detailStatus);
  const detailError = useAppSelector((state) => state.interactions.detailError);

  useEffect(() => {
    dispatch(fetchInteraction(id));
  }, [dispatch, id]);

  async function handleSubmit(data: InteractionFormPayload): Promise<ApiError | null> {
    // Notes changes do NOT auto-regenerate the insight — that's an explicit
    // Retry on the detail page (Phase 10's regenerate action), not a side
    // effect of saving an edit (see plan's "Known pitfalls").
    const { customer_id: _customerId, ...editable } = data;
    const result = await dispatch(updateInteraction({ id, data: editable }));
    if (updateInteraction.rejected.match(result)) {
      return result.payload ?? { code: "UNKNOWN_ERROR", message: "Failed to update interaction." };
    }
    router.push(`/interactions/${id}`);
    return null;
  }

  if (detailStatus === "loading" && !interaction) {
    return <p className="p-8 text-sm text-gray-500">Loading…</p>;
  }
  if (detailStatus === "failed" && detailError?.code === "PERMISSION_DENIED") {
    return (
      <p className="p-8 text-sm text-red-600">You don&apos;t have access to this interaction.</p>
    );
  }
  if (!interaction) return null;

  return (
    <div className="mx-auto max-w-2xl p-8">
      <h1 className="mb-4 text-xl font-semibold">Edit interaction</h1>
      <InteractionForm
        fixedCustomerId={interaction.customer_id}
        initial={{
          type: interaction.type,
          title: interaction.title,
          notes: interaction.notes,
          occurredAtIso: interaction.occurred_at,
          duration_minutes: interaction.duration_minutes,
        }}
        onSubmit={handleSubmit}
        submitLabel="Save changes"
      />
    </div>
  );
}
