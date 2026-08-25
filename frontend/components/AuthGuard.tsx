"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { refreshToken } from "@/store/slices/authSlice";

import WakingBanner from "./WakingBanner";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Wraps every authenticated route. On mount, with no user in state yet,
 * attempts a silent refresh from the cookie. A REFRESH_RACE (two tabs
 * rotating the same refresh cookie within the Phase 03 grace window) is
 * retried once after ~300ms rather than treated as a real auth failure.
 */
export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const user = useAppSelector((state) => state.auth.user);
  const [waking, setWaking] = useState(false);
  const attempted = useRef(false);

  useEffect(() => {
    if (user || attempted.current) return;
    attempted.current = true;

    let cancelled = false;
    const bannerTimer = setTimeout(() => {
      if (!cancelled) setWaking(true);
    }, 3000);

    async function attempt() {
      const first = await dispatch(refreshToken());
      if (refreshToken.fulfilled.match(first)) return;

      if (first.payload?.code === "REFRESH_RACE") {
        await sleep(300);
        const retry = await dispatch(refreshToken());
        if (refreshToken.fulfilled.match(retry)) return;
      }

      if (!cancelled) router.replace("/login");
    }

    attempt().finally(() => {
      clearTimeout(bannerTimer);
      if (!cancelled) setWaking(false);
    });

    return () => {
      cancelled = true;
      clearTimeout(bannerTimer);
    };
  }, [user, dispatch, router]);

  if (waking) return <WakingBanner />;
  if (!user) return null;
  return <>{children}</>;
}
