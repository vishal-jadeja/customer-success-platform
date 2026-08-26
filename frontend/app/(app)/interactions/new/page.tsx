"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

import InteractionForm from "@/components/interactions/InteractionForm";
import type { ApiError } from "@/lib/errors";
import { useAppDispatch } from "@/store/hooks";
import { createInteraction, type InteractionFormPayload } from "@/store/slices/interactionsSlice";
import Card from "@/components/ui/Card";
import PageContainer from "@/components/ui/PageContainer";
import PageHeader from "@/components/ui/PageHeader";
import Skeleton from "@/components/ui/Skeleton";

function NewInteractionForm() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const searchParams = useSearchParams();
  const customerId = searchParams.get("customer_id") ?? undefined;

  async function handleSubmit(data: InteractionFormPayload): Promise<ApiError | null> {
    const result = await dispatch(createInteraction(data));
    if (createInteraction.rejected.match(result)) {
      return result.payload ?? { code: "UNKNOWN_ERROR", message: "Failed to create interaction." };
    }
    router.push(`/interactions/${result.payload.id}`);
    return null;
  }

  return (
    <InteractionForm
      fixedCustomerId={customerId}
      onSubmit={handleSubmit}
      submitLabel="Create interaction"
    />
  );
}

export default function NewInteractionPage() {
  return (
    <PageContainer>
      <PageHeader title="New interaction" />
      <Card>
        {/* useSearchParams requires a Suspense boundary under the App Router */}
        <Suspense fallback={<Skeleton className="h-64 w-full" />}>
          <NewInteractionForm />
        </Suspense>
      </Card>
    </PageContainer>
  );
}
