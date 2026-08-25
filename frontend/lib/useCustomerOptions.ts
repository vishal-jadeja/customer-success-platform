import { useEffect, useState } from "react";

import { api } from "@/lib/axios";

export interface CustomerOption {
  id: string;
  name: string;
  company: string;
}

/**
 * Scoped list of customers for a <select>: reused by InteractionFilters and
 * InteractionForm so both dropdowns fetch the same way. `page_size=100` is
 * a pragmatic cap for a dropdown, not a real search — fine at this app's
 * scale (see master plan's "What I'd build next" for the single-tenant,
 * no-pagination-heavy assumption).
 */
export function useCustomerOptions(): CustomerOption[] {
  const [customers, setCustomers] = useState<CustomerOption[]>([]);

  useEffect(() => {
    let cancelled = false;
    api
      .get<{ items: CustomerOption[] }>("/customers", { params: { page_size: 100 } })
      .then(({ data }) => {
        if (!cancelled) setCustomers(data.items);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  return customers;
}
