"use client";

import { useRouter } from "next/navigation";

import CustomerForm from "@/components/customers/CustomerForm";
import type { ApiError } from "@/lib/errors";
import { useAppDispatch } from "@/store/hooks";
import { createCustomer, type CustomerFormPayload } from "@/store/slices/customersSlice";
import Card from "@/components/ui/Card";
import PageContainer from "@/components/ui/PageContainer";
import PageHeader from "@/components/ui/PageHeader";

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
    <PageContainer>
      <PageHeader title="New customer" />
      <Card>
        <CustomerForm onSubmit={handleSubmit} submitLabel="Create customer" />
      </Card>
    </PageContainer>
  );
}
