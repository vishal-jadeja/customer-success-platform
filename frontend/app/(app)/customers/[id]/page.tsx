"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";
import { Plus } from "lucide-react";

import InteractionList from "@/components/interactions/InteractionList";
import { CUSTOMER_STATUS_LABEL, CUSTOMER_STATUS_TONE } from "@/lib/colors";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { deleteCustomer, fetchCustomer } from "@/store/slices/customersSlice";
import { fetchForCustomer } from "@/store/slices/interactionsSlice";
import Badge from "@/components/ui/Badge";
import Button, { buttonClass } from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import HealthDot from "@/components/ui/HealthDot";
import PageContainer from "@/components/ui/PageContainer";
import PageHeader from "@/components/ui/PageHeader";
import Skeleton from "@/components/ui/Skeleton";

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
    return (
      <PageContainer>
        <Skeleton className="h-8 w-64" />
        <Skeleton className="mt-6 h-40 w-full" />
      </PageContainer>
    );
  }
  if (detailStatus === "failed" && detailError?.code === "PERMISSION_DENIED") {
    return (
      <PageContainer>
        <p className="text-sm text-bad">You don&apos;t have access to this customer.</p>
      </PageContainer>
    );
  }
  if (detailStatus === "failed") {
    return (
      <PageContainer>
        <p className="text-sm text-bad">{detailError?.message ?? "Failed to load."}</p>
      </PageContainer>
    );
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
    <PageContainer>
      <PageHeader
        title={
          <span className="inline-flex items-center gap-2.5">
            <HealthDot tone={CUSTOMER_STATUS_TONE[customer.status]} size="lg" />
            {customer.name}
          </span>
        }
        subtitle={customer.company}
        action={
          <div className="flex gap-2">
            {canEdit && (
              <Link href={`/customers/${id}/edit`} className={buttonClass("secondary")}>
                Edit
              </Link>
            )}
            {canDelete && (
              <Button variant="danger" onClick={handleDelete}>
                Delete
              </Button>
            )}
          </div>
        }
      />

      <Card>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm sm:grid-cols-3">
          <Stat label="Status">
            <Badge tone={CUSTOMER_STATUS_TONE[customer.status]}>
              {CUSTOMER_STATUS_LABEL[customer.status]}
            </Badge>
          </Stat>
          <Stat label="Health score">
            <span className="font-mono tabular-nums">{customer.health_score}</span>
          </Stat>
          <Stat label="ARR">
            <span className="font-mono tabular-nums">{customer.arr ?? "—"}</span>
          </Stat>
          <Stat label="Email">{customer.email}</Stat>
          <Stat label="Phone">{customer.phone ?? "—"}</Stat>
          <Stat label="Industry">{customer.industry ?? "—"}</Stat>
          <Stat label="Owner">{customer.owner?.full_name ?? "—"}</Stat>
          <Stat label="Interactions">
            <span className="font-mono tabular-nums">
              {customer.interaction_count ?? interactions.length}
            </span>
          </Stat>
        </dl>
      </Card>

      <div className="mt-8 mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-text">Interactions</h2>
        <Link href={`/interactions/new?customer_id=${id}`} className={buttonClass("primary", "sm")}>
          <Plus className="h-3.5 w-3.5" />
          New interaction
        </Link>
      </div>
      {interactionsStatus === "loading" ? (
        <Skeleton className="h-32 w-full" />
      ) : (
        <InteractionList interactions={interactions} expandableInsights />
      )}
    </PageContainer>
  );
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-text-muted">{label}</dt>
      <dd className="mt-0.5 text-text">{children}</dd>
    </div>
  );
}
