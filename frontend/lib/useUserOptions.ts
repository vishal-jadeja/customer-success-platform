import { useEffect, useState } from "react";

import { api } from "@/lib/axios";
import type { User } from "@/store/slices/authSlice";

interface UsersPage {
  items: User[];
}

/**
 * Scoped list of users for a <select>: reused by CustomerForm's owner picker
 * and the customer list's owner filter, mirroring `useCustomerOptions`'s
 * shape. `enabled` lets a caller skip the fetch entirely (e.g. a csm, who
 * can never assign or filter by owner) rather than firing a request whose
 * 403 would just be swallowed.
 */
export function useUserOptions(enabled: boolean = true): User[] {
  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    api
      .get<UsersPage>("/users", { params: { page_size: 100 } })
      .then(({ data }) => {
        if (!cancelled) setUsers(data.items);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return users;
}
