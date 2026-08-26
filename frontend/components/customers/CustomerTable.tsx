"use client";

import { useRouter } from "next/navigation";

import { CUSTOMER_STATUS_LABEL, CUSTOMER_STATUS_TONE } from "@/lib/colors";
import { formatCurrency } from "@/lib/format";
import type { Customer } from "@/store/slices/customersSlice";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import HealthDot from "@/components/ui/HealthDot";
import { Table, TBody, TCell, TH, THead, TRow } from "@/components/ui/Table";
import { Users } from "lucide-react";

export default function CustomerTable({ customers }: { customers: Customer[] }) {
  const router = useRouter();

  if (customers.length === 0) {
    return (
      <div className="rounded-2xl border border-hairline bg-panel backdrop-blur-xl">
        <EmptyState icon={Users} title="No customers found" description="Try adjusting your filters." />
      </div>
    );
  }

  return (
    <Table>
      <THead>
        <TH>Name</TH>
        <TH>Company</TH>
        <TH>Status</TH>
        <TH>Health</TH>
        <TH>ARR</TH>
        <TH>Industry</TH>
      </THead>
      <TBody>
        {customers.map((c) => (
          <TRow key={c.id} onClick={() => router.push(`/customers/${c.id}`)}>
            <TCell className="font-medium">{c.name}</TCell>
            <TCell className="text-text-secondary">{c.company}</TCell>
            <TCell>
              <Badge tone={CUSTOMER_STATUS_TONE[c.status]}>{CUSTOMER_STATUS_LABEL[c.status]}</Badge>
            </TCell>
            <TCell>
              <span className="inline-flex items-center gap-2 font-mono tabular-nums">
                <HealthDot tone={CUSTOMER_STATUS_TONE[c.status]} />
                {c.health_score}
              </span>
            </TCell>
            <TCell className="font-mono tabular-nums text-text-secondary">
              {c.arr != null ? formatCurrency(c.arr) : "—"}
            </TCell>
            <TCell className="text-text-secondary">{c.industry ?? "—"}</TCell>
          </TRow>
        ))}
      </TBody>
    </Table>
  );
}
