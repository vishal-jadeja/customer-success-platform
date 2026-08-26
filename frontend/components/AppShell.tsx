"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  LogOut,
  MessagesSquare,
  UserCircle,
  Users2,
  UsersRound,
} from "lucide-react";

import RoleGate from "@/components/common/RoleGate";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { logout } from "@/store/slices/authSlice";
import { cn } from "@/lib/cn";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/customers", label: "Customers", icon: Users2 },
  { href: "/interactions", label: "Interactions", icon: MessagesSquare },
] as const;

export default function AppShell({ children }: { children: React.ReactNode }) {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const pathname = usePathname();
  const user = useAppSelector((state) => state.auth.user);

  async function handleLogout() {
    await dispatch(logout());
    router.push("/login");
  }

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-16 shrink-0 flex-col border-r border-hairline bg-raised/40 backdrop-blur-xl lg:w-60">
        <Link
          href="/dashboard"
          className="flex h-14 items-center gap-2.5 border-b border-hairline px-4 lg:px-5"
        >
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-accent to-accent-2 text-xs font-bold text-white">
            C
          </span>
          <span className="hidden text-sm font-semibold tracking-tight text-text lg:inline">
            CSP
          </span>
        </Link>

        <nav className="flex flex-1 flex-col gap-1 p-2 lg:p-3">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = isActive(href);
            return (
              <Link
                key={href}
                href={href}
                title={label}
                className={cn(
                  "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-accent-soft text-text"
                    : "text-text-secondary hover:bg-panel hover:text-text",
                )}
              >
                <span
                  className={cn(
                    "absolute top-1/2 left-0 h-4 w-0.5 -translate-y-1/2 rounded-full bg-accent transition-opacity",
                    active ? "opacity-100" : "opacity-0",
                  )}
                />
                <Icon className="h-4 w-4 shrink-0" />
                <span className="hidden lg:inline">{label}</span>
              </Link>
            );
          })}

          <RoleGate allow={["admin", "manager"]}>
            <Link
              href="/users"
              title="Users"
              className={cn(
                "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive("/users")
                  ? "bg-accent-soft text-text"
                  : "text-text-secondary hover:bg-panel hover:text-text",
              )}
            >
              <span
                className={cn(
                  "absolute top-1/2 left-0 h-4 w-0.5 -translate-y-1/2 rounded-full bg-accent transition-opacity",
                  isActive("/users") ? "opacity-100" : "opacity-0",
                )}
              />
              <UsersRound className="h-4 w-4 shrink-0" />
              <span className="hidden lg:inline">Users</span>
            </Link>
          </RoleGate>
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-end gap-3 border-b border-hairline px-4 sm:px-6">
          {user && (
            <Link
              href="/profile"
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-panel"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-panel-strong text-xs font-semibold text-text-secondary">
                <UserCircle className="h-4 w-4" />
              </span>
              <span className="hidden text-text-secondary sm:inline">
                {user.full_name} <span className="text-text-muted">· {user.role}</span>
              </span>
            </Link>
          )}
          <button
            type="button"
            onClick={handleLogout}
            title="Log out"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-panel hover:text-bad"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </header>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
