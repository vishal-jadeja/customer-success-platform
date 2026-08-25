"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";

import InteractionList from "@/components/interactions/InteractionList";
import { CUSTOMER_STATUS_BADGE_CLASS } from "@/lib/colors";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { deleteCustomer, fetchCustomer } from "@/store/slices/customersSlice";
import { fetchForCustomer } from "@/store/slices/interactionsSlice";

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const dispatch = useAppDispatch();
  const router = useRouter();
  const currentUser = useAppSelector((state) => state.auth.user);
  const customer = useAppSelector((state) => state.customers.entities[id]);
  const detailStatus = useAppSelector((state) => state.customers.detailStatus);
  const detailError = useAppSelector((state) => state.customers.detailError);
  const interactionIds = useAppSelector((state) => state.interactions.ids);
  const interactionEntities = useAppSelector((state) => state.interactions.entities);
  const interactionsStatus = useAppSelector((state) => state.interactions.status);

  useEffect(() => {
    dispatch(fetchCustomer(id));
    dispatch(fetchForCustomer({ customerId: id }));
  }, [dispatch, id]);

  if (detailStatus === "loading" && !customer) {
    return <p className="p-8 text-sm text-gray-500">Loading…</p>;
  }
  if (detailStatus === "failed" && detailError?.code === "PERMISSION_DENIED") {
    return <p className="p-8 text-sm text-red-600">You don&apos;t have access to this customer.</p>;
  }
  if (detailStatus === "failed") {
    return <p className="p-8 text-sm text-red-600">{detailError?.message ?? "Failed to load."}</p>;
  }
  if (!customer) return null;

  const canEdit =
    currentUser?.role === "admin" ||
    currentUser?.role === "manager" ||
    (currentUser?.role === "csm" && customer.owner_id === currentUser.id);
  const canDelete = currentUser?.role === "admin";

  async function handleDelete() {
    const result = await dispatch(deleteCustomer(id));
    if (deleteCustomer.fulfilled.match(result)) {
      router.push("/customers");
    }
  }

  const interactions = interactionIds.map((iid) => interactionEntities[iid]);

  return (
    <div className="mx-auto max-w-4xl p-8">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold">{customer.name}</h1>
          <p className="text-sm text-gray-500">{customer.company}</p>
        </div>
        <div className="flex gap-2">
          {canEdit && (
            <Link
              href={`/customers/${id}/edit`}
              className="rounded border px-3 py-1.5 text-sm hover:bg-gray-50"
            >
              Edit
            </Link>
          )}
          {canDelete && (
            <button
              type="button"
              onClick={handleDelete}
              className="rounded border border-red-300 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
            >
              Delete
            </button>
          )}
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-x-6 gap-y-2 rounded border p-4 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-gray-500">Status</dt>
          <dd>
            <span className={`rounded px-2 py-0.5 text-xs ${CUSTOMER_STATUS_BADGE_CLASS[customer.status]}`}>
              {customer.status}
            </span>
          </dd>
        </div>
        <div>
          <dt className="text-gray-500">Health score</dt>
          <dd>{customer.health_score}</dd>
        </div>
        <div>
          <dt className="text-gray-500">ARR</dt>
          <dd>{customer.arr ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-gray-500">Email</dt>
          <dd>{customer.email}</dd>
        </div>
        <div>
          <dt className="text-gray-500">Phone</dt>
          <dd>{customer.phone ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-gray-500">Industry</dt>
          <dd>{customer.industry ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-gray-500">Owner</dt>
          <dd>{customer.owner?.full_name ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-gray-500">Interactions</dt>
          <dd>{customer.interaction_count ?? interactions.length}</dd>
        </div>
      </dl>

      <div className="mt-6 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Interactions</h2>
        <Link
          href={`/interactions/new?customer_id=${id}`}
          className="rounded bg-black px-3 py-1.5 text-sm text-white"
        >
          New interaction
        </Link>
      </div>
      <div className="mt-2 rounded border">
        {interactionsStatus === "loading" && (
          <p className="p-6 text-center text-sm text-gray-500">Loading…</p>
        )}
        {interactionsStatus === "succeeded" && (
          <InteractionList interactions={interactions} expandableInsights />
        )}
      </div>
    </div>
  );
}
