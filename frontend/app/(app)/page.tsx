"use client";

import { useAppSelector } from "@/store/hooks";

// Placeholder authenticated home — the real dashboard (KPI cards, sentiment
// trend, at-risk list) is Phase 10. This just gives login/register a real
// working landing target now.
export default function AppHomePage() {
  const user = useAppSelector((state) => state.auth.user);

  return (
    <div className="mx-auto max-w-2xl p-8">
      <h1 className="text-xl font-semibold">
        Signed in as {user?.full_name} ({user?.role})
      </h1>
      <p className="mt-2 text-gray-600">
        Customers, interactions, and the dashboard land in later phases.
      </p>
    </div>
  );
}
