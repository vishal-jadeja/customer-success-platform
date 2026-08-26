"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect } from "react";
import { ArrowRight } from "lucide-react";

import InsightPanel from "@/components/insights/InsightPanel";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchInteraction } from "@/store/slices/interactionsSlice";
import Card from "@/components/ui/Card";
import PageContainer from "@/components/ui/PageContainer";
import PageHeader from "@/components/ui/PageHeader";
import Skeleton from "@/components/ui/Skeleton";
import { buttonClass } from "@/components/ui/Button";

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
    return (
      <PageContainer>
        <Skeleton className="h-8 w-64" />
        <Skeleton className="mt-6 h-32 w-full" />
      </PageContainer>
    );
  }
  if (detailStatus === "failed" && detailError?.code === "PERMISSION_DENIED") {
    return (
      <PageContainer>
        <p className="text-sm text-bad">You don&apos;t have access to this interaction.</p>
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
  if (!interaction) return null;

  const canEdit =
    currentUser?.role === "admin" ||
    currentUser?.role === "manager" ||
    interaction.user_id === currentUser?.id;

  return (
    <PageContainer>
      <PageHeader
        title={interaction.title}
        subtitle={
          <Link
            href={`/customers/${interaction.customer_id}`}
            className="inline-flex items-center gap-1 text-accent hover:underline"
          >
            View customer
            <ArrowRight className="h-3 w-3" />
          </Link>
        }
        action={
          canEdit && (
            <Link href={`/interactions/${id}/edit`} className={buttonClass("secondary")}>
              Edit
            </Link>
          )
        }
      />

      <Card>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-xs text-text-muted">Type</dt>
            <dd className="mt-0.5 text-text capitalize">{interaction.type.replace("_", " ")}</dd>
          </div>
          <div>
            <dt className="text-xs text-text-muted">Occurred at</dt>
            <dd className="mt-0.5 text-text">{new Date(interaction.occurred_at).toLocaleString()}</dd>
          </div>
          <div>
            <dt className="text-xs text-text-muted">Duration</dt>
            <dd className="mt-0.5 font-mono text-text tabular-nums">
              {interaction.duration_minutes != null ? `${interaction.duration_minutes} min` : "—"}
            </dd>
          </div>
        </dl>
      </Card>

      <Card title="Notes" className="mt-4">
        <p className="text-sm whitespace-pre-wrap text-text-secondary">{interaction.notes}</p>
      </Card>

      <InsightPanel interaction={interaction} variant="full" className="mt-4" />
    </PageContainer>
  );
}
