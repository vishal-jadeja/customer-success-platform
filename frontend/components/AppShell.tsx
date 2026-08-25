"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { logout } from "@/store/slices/authSlice";

// Nav is deliberately minimal this phase: Customers/Interactions/Dashboard
// pages don't exist yet (Phase 09/10) and linking to them now would be
// exactly the dead link the master plan warns against for the optional
// Users page. Each phase adds its own nav entry when its page ships.
export default function AppShell({ children }: { children: React.ReactNode }) {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const user = useAppSelector((state) => state.auth.user);

  async function handleLogout() {
    await dispatch(logout());
    router.push("/login");
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b px-6 py-3">
        <Link href="/" className="font-semibold">
          CSP
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/profile" className="hover:underline">
            Profile
          </Link>
          {user && (
            <span className="text-gray-500">
              {user.full_name} &middot; {user.role}
            </span>
          )}
          <button
            type="button"
            onClick={handleLogout}
            className="rounded border px-3 py-1 hover:bg-gray-50"
          >
            Logout
          </button>
        </nav>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
