"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import Filters, { FilterField } from "@/components/common/Filters";
import Pagination from "@/components/common/Pagination";
import CustomerTable from "@/components/customers/CustomerTable";
import { customerSorts, customerStatuses } from "@/schemas/customer";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  fetchCustomers,
  type CustomerListParams,
} from "@/store/slices/customersSlice";

const EMPTY_FILTERS: CustomerListParams = {
  q: "",
  status: "",
  industry: "",
  min_health: undefined,
  max_health: undefined,
  sort: "created_at",
  order: "desc",
};

export default function CustomersPage() {
  const dispatch = useAppDispatch();
  const { ids, entities, total, page, page_size, status, error } = useAppSelector(
    (state) => state.customers,
  );
  const [form, setForm] = useState<CustomerListParams>(EMPTY_FILTERS);

  function load(params: CustomerListParams) {
    dispatch(fetchCustomers(params));
  }

  useEffect(() => {
    load(EMPTY_FILTERS);
    // Only on mount — filter changes are applied explicitly via the form's
    // submit so partially-typed input doesn't fire a request per keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleFilterSubmit(e: React.FormEvent) {
    e.preventDefault();
    load({ ...form, page: 1 });
  }

  const customers = ids.map((id) => entities[id]);

  return (
    <div className="mx-auto max-w-5xl p-8">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Customers</h1>
        <Link href="/customers/new" className="rounded bg-black px-3 py-2 text-sm text-white">
          New customer
        </Link>
      </div>

      <form onSubmit={handleFilterSubmit}>
        <Filters>
          <FilterField label="Search">
            <input
              className="rounded border px-2 py-1"
              value={form.q}
              onChange={(e) => setForm({ ...form, q: e.target.value })}
              placeholder="Name, company, email…"
            />
          </FilterField>
          <FilterField label="Status">
            <select
              className="rounded border px-2 py-1"
              value={form.status}
              onChange={(e) =>
                setForm({ ...form, status: e.target.value as CustomerListParams["status"] })
              }
            >
              <option value="">Any</option>
              {customerStatuses.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </FilterField>
          <FilterField label="Industry">
            <input
              className="rounded border px-2 py-1"
              value={form.industry}
              onChange={(e) => setForm({ ...form, industry: e.target.value })}
            />
          </FilterField>
          <FilterField label="Min health">
            <input
              type="number"
              min={0}
              max={100}
              className="w-20 rounded border px-2 py-1"
              value={form.min_health ?? ""}
              onChange={(e) =>
                setForm({
                  ...form,
                  min_health: e.target.value === "" ? undefined : Number(e.target.value),
                })
              }
            />
          </FilterField>
          <FilterField label="Max health">
            <input
              type="number"
              min={0}
              max={100}
              className="w-20 rounded border px-2 py-1"
              value={form.max_health ?? ""}
              onChange={(e) =>
                setForm({
                  ...form,
                  max_health: e.target.value === "" ? undefined : Number(e.target.value),
                })
              }
            />
          </FilterField>
          <FilterField label="Sort">
            <select
              className="rounded border px-2 py-1"
              value={form.sort}
              onChange={(e) =>
                setForm({ ...form, sort: e.target.value as CustomerListParams["sort"] })
              }
            >
              {customerSorts.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </FilterField>
          <FilterField label="Order">
            <select
              className="rounded border px-2 py-1"
              value={form.order}
              onChange={(e) =>
                setForm({ ...form, order: e.target.value as CustomerListParams["order"] })
              }
            >
              <option value="desc">Desc</option>
              <option value="asc">Asc</option>
            </select>
          </FilterField>
          <button type="submit" className="rounded bg-black px-3 py-1.5 text-sm text-white">
            Apply
          </button>
        </Filters>
      </form>

      <div className="mt-4 rounded border">
        {status === "loading" && <p className="p-6 text-center text-sm text-gray-500">Loading…</p>}
        {status === "failed" && (
          <div className="p-6 text-center text-sm text-red-600">
            {error?.message ?? "Failed to load customers."}{" "}
            <button className="underline" onClick={() => load(form)} type="button">
              Retry
            </button>
          </div>
        )}
        {status === "succeeded" && <CustomerTable customers={customers} />}
      </div>

      {status === "succeeded" && (
        <Pagination
          page={page}
          pageSize={page_size}
          total={total}
          onPageChange={(p) => load({ ...form, page: p })}
        />
      )}
    </div>
  );
}
