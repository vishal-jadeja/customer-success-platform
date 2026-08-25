"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";

import CustomerForm from "@/components/customers/CustomerForm";
import type { ApiError } from "@/lib/errors";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchCustomer, updateCustomer, type CustomerFormPayload } from "@/store/slices/customersSlice";

export default function EditCustomerPage() {
  const { id } = useParams<{ id: string }>();
  const dispatch = useAppDispatch();
  const router = useRouter();
  const customer = useAppSelector((state) => state.customers.entities[id]);
  const detailStatus = useAppSelector((state) => state.customers.detailStatus);
  const detailError = useAppSelector((state) => state.customers.detailError);

  useEffect(() => {
    dispatch(fetchCustomer(id));
  }, [dispatch, id]);

  async function handleSubmit(data: CustomerFormPayload): Promise<ApiError | null> {
    const result = await dispatch(updateCustomer({ id, data }));
    if (updateCustomer.rejected.match(result)) {
      return result.payload ?? { code: "UNKNOWN_ERROR", message: "Failed to update customer." };
    }
    router.push(`/customers/${id}`);
    return null;
  }

  if (detailStatus === "loading" && !customer) {
    return <p className="p-8 text-sm text-gray-500">Loading…</p>;
  }
  if (detailStatus === "failed" && detailError?.code === "PERMISSION_DENIED") {
    return <p className="p-8 text-sm text-red-600">You don&apos;t have access to this customer.</p>;
  }
  if (!customer) return null;

  return (
    <div className="mx-auto max-w-2xl p-8">
      <h1 className="mb-4 text-xl font-semibold">Edit customer</h1>
      <CustomerForm
        defaultValues={{
          name: customer.name,
          company: customer.company,
          email: customer.email,
          phone: customer.phone ?? "",
          industry: customer.industry ?? "",
          status: customer.status,
          health_score: customer.health_score,
          arr: customer.arr ?? "",
        }}
        onSubmit={handleSubmit}
        submitLabel="Save changes"
      />
    </div>
  );
}
