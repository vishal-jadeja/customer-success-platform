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
import Card from "@/components/ui/Card";
import PageContainer from "@/components/ui/PageContainer";
import PageHeader from "@/components/ui/PageHeader";
import Skeleton from "@/components/ui/Skeleton";

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
    return (
      <PageContainer>
        <Skeleton className="h-8 w-64" />
        <Skeleton className="mt-6 h-96 w-full" />
      </PageContainer>
    );
  }
  if (detailStatus === "failed" && detailError?.code === "PERMISSION_DENIED") {
    return (
      <PageContainer>
        <p className="text-sm text-bad">You don&apos;t have access to this interaction.</p>
      </PageContainer>
    );
  }
  if (!interaction) return null;

  return (
    <PageContainer>
      <PageHeader title="Edit interaction" />
      <Card>
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
      </Card>
    </PageContainer>
  );
}
