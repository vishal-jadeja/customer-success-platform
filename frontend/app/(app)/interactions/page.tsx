"use client";

import { useEffect, useState } from "react";

import Pagination from "@/components/common/Pagination";
import InteractionFilters from "@/components/interactions/InteractionFilters";
import InteractionList from "@/components/interactions/InteractionList";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchInteractions, type InteractionListParams } from "@/store/slices/interactionsSlice";

const EMPTY_FILTERS: InteractionListParams = {};

export default function InteractionsPage() {
  const dispatch = useAppDispatch();
  const { ids, entities, total, page, page_size, status, error } = useAppSelector(
    (state) => state.interactions,
  );
  const [filters, setFilters] = useState<InteractionListParams>(EMPTY_FILTERS);

  function load(params: InteractionListParams) {
    dispatch(fetchInteractions(params));
  }

  useEffect(() => {
    load(EMPTY_FILTERS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const interactions = ids.map((id) => entities[id]);

  return (
    <div className="mx-auto max-w-5xl p-8">
      <h1 className="mb-4 text-xl font-semibold">Interactions</h1>

      <InteractionFilters
        value={filters}
        onChange={setFilters}
        onApply={() => load({ ...filters, page: 1 })}
      />

      <div className="mt-4 rounded border">
        {status === "loading" && <p className="p-6 text-center text-sm text-gray-500">Loading…</p>}
        {status === "failed" && (
          <div className="p-6 text-center text-sm text-red-600">
            {error?.message ?? "Failed to load interactions."}{" "}
            <button className="underline" onClick={() => load(filters)} type="button">
              Retry
            </button>
          </div>
        )}
        {status === "succeeded" && <InteractionList interactions={interactions} />}
      </div>

      {status === "succeeded" && (
        <Pagination
          page={page}
          pageSize={page_size}
          total={total}
          onPageChange={(p) => load({ ...filters, page: p })}
        />
      )}
    </div>
  );
}
