"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

import InteractionForm from "@/components/interactions/InteractionForm";
import type { ApiError } from "@/lib/errors";
import { useAppDispatch } from "@/store/hooks";
import { createInteraction, type InteractionFormPayload } from "@/store/slices/interactionsSlice";

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
    <div className="mx-auto max-w-2xl p-8">
      <h1 className="mb-4 text-xl font-semibold">New interaction</h1>
      {/* useSearchParams requires a Suspense boundary under the App Router */}
      <Suspense fallback={<p className="text-sm text-gray-500">Loading…</p>}>
        <NewInteractionForm />
      </Suspense>
    </div>
  );
}
