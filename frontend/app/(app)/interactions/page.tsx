"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Plus } from "lucide-react";

import Pagination from "@/components/common/Pagination";
import InteractionFilters from "@/components/interactions/InteractionFilters";
import InteractionList from "@/components/interactions/InteractionList";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchInteractions, type InteractionListParams } from "@/store/slices/interactionsSlice";
import { buttonClass } from "@/components/ui/Button";
import PageContainer from "@/components/ui/PageContainer";
import PageHeader from "@/components/ui/PageHeader";
import Skeleton from "@/components/ui/Skeleton";

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
    <PageContainer width="wide">
      <PageHeader
        title="Interactions"
        action={
          <Link href="/interactions/new" className={buttonClass("primary")}>
            <Plus className="h-4 w-4" />
            New interaction
          </Link>
        }
      />

      <InteractionFilters
        value={filters}
        onChange={setFilters}
        onApply={() => load({ ...filters, page: 1 })}
      />

      <div className="mt-4">
        {status === "loading" && <Skeleton className="h-64 w-full" />}
        {status === "failed" && (
          <div className="rounded-2xl border border-warn/20 bg-warn-soft p-6 text-center text-sm text-warn">
            {error?.message ?? "Failed to load interactions."}{" "}
            <button className="hover:underline" onClick={() => load(filters)} type="button">
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
    </PageContainer>
  );
}
