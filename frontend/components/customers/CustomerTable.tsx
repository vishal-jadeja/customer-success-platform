"use client";

import { useRouter } from "next/navigation";

import { CUSTOMER_STATUS_BADGE_CLASS } from "@/lib/colors";
import type { Customer } from "@/store/slices/customersSlice";

export default function CustomerTable({ customers }: { customers: Customer[] }) {
  const router = useRouter();

  if (customers.length === 0) {
    return <p className="p-6 text-center text-sm text-gray-500">No customers found.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b text-gray-500">
            <th className="py-2 pr-4">Name</th>
            <th className="py-2 pr-4">Company</th>
            <th className="py-2 pr-4">Status</th>
            <th className="py-2 pr-4">Health</th>
            <th className="py-2 pr-4">ARR</th>
            <th className="py-2 pr-4">Industry</th>
          </tr>
        </thead>
        <tbody>
          {customers.map((c) => (
            <tr
              key={c.id}
              className="cursor-pointer border-b hover:bg-gray-50"
              onClick={() => router.push(`/customers/${c.id}`)}
            >
              <td className="py-2 pr-4 font-medium">{c.name}</td>
              <td className="py-2 pr-4">{c.company}</td>
              <td className="py-2 pr-4">
                <span
                  className={`rounded px-2 py-0.5 text-xs ${CUSTOMER_STATUS_BADGE_CLASS[c.status] ?? ""}`}
                >
                  {c.status}
                </span>
              </td>
              <td className="py-2 pr-4">{c.health_score}</td>
              <td className="py-2 pr-4">{c.arr ?? "—"}</td>
              <td className="py-2 pr-4">{c.industry ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
