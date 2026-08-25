"use client";

import { useRouter } from "next/navigation";

import CustomerForm from "@/components/customers/CustomerForm";
import type { ApiError } from "@/lib/errors";
import { useAppDispatch } from "@/store/hooks";
import { createCustomer, type CustomerFormPayload } from "@/store/slices/customersSlice";

export default function NewCustomerPage() {
  const dispatch = useAppDispatch();
  const router = useRouter();

  async function handleSubmit(data: CustomerFormPayload): Promise<ApiError | null> {
    const result = await dispatch(createCustomer(data));
    if (createCustomer.rejected.match(result)) {
      return result.payload ?? { code: "UNKNOWN_ERROR", message: "Failed to create customer." };
    }
    router.push(`/customers/${result.payload.id}`);
    return null;
  }

  return (
    <div className="mx-auto max-w-2xl p-8">
      <h1 className="mb-4 text-xl font-semibold">New customer</h1>
      <CustomerForm onSubmit={handleSubmit} submitLabel="Create customer" />
    </div>
  );
}
