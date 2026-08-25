"use client";

import type { Role } from "@/store/slices/authSlice";
import { useAppSelector } from "@/store/hooks";

/**
 * Renders children only if the current user's role is in `allow`. UX only —
 * the backend re-checks role + row ownership on every request (see the
 * two-level RBAC note in CLAUDE.md). Author-specific checks (e.g.
 * `interaction.user_id === user.id`) are done in the calling component,
 * not here, since RoleGate only knows about roles.
 */
export default function RoleGate({
  allow,
  children,
}: {
  allow: Role[];
  children: React.ReactNode;
}) {
  const user = useAppSelector((state) => state.auth.user);
  if (!user || !allow.includes(user.role)) return null;
  return <>{children}</>;
}
