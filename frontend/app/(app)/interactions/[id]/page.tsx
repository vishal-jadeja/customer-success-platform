"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect } from "react";

import InsightPanel from "@/components/insights/InsightPanel";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchInteraction } from "@/store/slices/interactionsSlice";

export default function InteractionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const dispatch = useAppDispatch();
  const currentUser = useAppSelector((state) => state.auth.user);
  const interaction = useAppSelector((state) => state.interactions.entities[id]);
  const detailStatus = useAppSelector((state) => state.interactions.detailStatus);
  const detailError = useAppSelector((state) => state.interactions.detailError);

  useEffect(() => {
    dispatch(fetchInteraction(id));
  }, [dispatch, id]);

  if (detailStatus === "loading" && !interaction) {
    return <p className="p-8 text-sm text-gray-500">Loading…</p>;
  }
  if (detailStatus === "failed" && detailError?.code === "PERMISSION_DENIED") {
    return (
      <p className="p-8 text-sm text-red-600">You don&apos;t have access to this interaction.</p>
    );
  }
  if (detailStatus === "failed") {
    return <p className="p-8 text-sm text-red-600">{detailError?.message ?? "Failed to load."}</p>;
  }
  if (!interaction) return null;

  const canEdit =
    currentUser?.role === "admin" ||
    currentUser?.role === "manager" ||
    interaction.user_id === currentUser?.id;

  return (
    <div className="mx-auto max-w-3xl p-8">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold">{interaction.title}</h1>
          <p className="text-sm text-gray-500">
            <Link href={`/customers/${interaction.customer_id}`} className="underline">
              View customer
            </Link>
          </p>
        </div>
        {canEdit && (
          <Link
            href={`/interactions/${id}/edit`}
            className="rounded border px-3 py-1.5 text-sm hover:bg-gray-50"
          >
            Edit
          </Link>
        )}
      </div>

      <dl className="grid grid-cols-2 gap-x-6 gap-y-2 rounded border p-4 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-gray-500">Type</dt>
          <dd className="capitalize">{interaction.type.replace("_", " ")}</dd>
        </div>
        <div>
          <dt className="text-gray-500">Occurred at</dt>
          <dd>{new Date(interaction.occurred_at).toLocaleString()}</dd>
        </div>
        <div>
          <dt className="text-gray-500">Duration</dt>
          <dd>
            {interaction.duration_minutes != null ? `${interaction.duration_minutes} min` : "—"}
          </dd>
        </div>
      </dl>

      <div className="mt-4 rounded border p-4">
        <h2 className="text-sm font-semibold text-gray-600">Notes</h2>
        <p className="mt-2 whitespace-pre-wrap text-sm">{interaction.notes}</p>
      </div>

      <InsightPanel interaction={interaction} variant="full" className="mt-4" />
    </div>
  );
}
