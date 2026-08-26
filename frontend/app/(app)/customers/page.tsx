"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Plus } from "lucide-react";

import Filters, { FilterField } from "@/components/common/Filters";
import Pagination from "@/components/common/Pagination";
import CustomerTable from "@/components/customers/CustomerTable";
import { customerSorts, customerStatuses } from "@/schemas/customer";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  fetchCustomers,
  type CustomerListParams,
} from "@/store/slices/customersSlice";
import Button, { buttonClass } from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import PageContainer from "@/components/ui/PageContainer";
import PageHeader from "@/components/ui/PageHeader";
import Select from "@/components/ui/Select";
import Skeleton from "@/components/ui/Skeleton";

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
    <PageContainer width="wide">
      <PageHeader
        title="Customers"
        action={
          <Link href="/customers/new" className={buttonClass("primary")}>
            <Plus className="h-4 w-4" />
            New customer
          </Link>
        }
      />

      <form onSubmit={handleFilterSubmit}>
        <Filters>
          <FilterField label="Search">
            <Input
              value={form.q}
              onChange={(e) => setForm({ ...form, q: e.target.value })}
              placeholder="Name, company, email…"
            />
          </FilterField>
          <FilterField label="Status">
            <Select
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
            </Select>
          </FilterField>
          <FilterField label="Industry">
            <Input
              value={form.industry}
              onChange={(e) => setForm({ ...form, industry: e.target.value })}
            />
          </FilterField>
          <FilterField label="Min health">
            <Input
              type="number"
              min={0}
              max={100}
              className="w-20"
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
            <Input
              type="number"
              min={0}
              max={100}
              className="w-20"
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
            <Select
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
            </Select>
          </FilterField>
          <FilterField label="Order">
            <Select
              value={form.order}
              onChange={(e) =>
                setForm({ ...form, order: e.target.value as CustomerListParams["order"] })
              }
            >
              <option value="desc">Desc</option>
              <option value="asc">Asc</option>
            </Select>
          </FilterField>
          <Button type="submit" size="sm">
            Apply
          </Button>
        </Filters>
      </form>

      <div className="mt-4">
        {status === "loading" && <Skeleton className="h-64 w-full" />}
        {status === "failed" && (
          <div className="rounded-2xl border border-warn/20 bg-warn-soft p-6 text-center text-sm text-warn">
            {error?.message ?? "Failed to load customers."}{" "}
            <button className="hover:underline" onClick={() => load(form)} type="button">
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
    </PageContainer>
  );
}
