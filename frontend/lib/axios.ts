import axios, { type InternalAxiosRequestConfig } from "axios";

/**
 * baseURL is RELATIVE and there is NO withCredentials: every call goes to
 * this Next.js origin's /api/v1/* and the proxy rewrite (next.config.ts)
 * forwards it server-side, so the refresh cookie stays first-party and
 * arrives automatically. An absolute backend URL here would reintroduce the
 * cross-site cookie problem this whole design avoids.
 */
export const api = axios.create({
  baseURL: "/api/v1",
  timeout: 15000,
});

// In-memory only — NEVER localStorage. This module intentionally does not
// import the Redux store; authSlice's thunks call setAccessToken alongside
// updating Redux state, so both stay in sync from one place.
let accessToken: string | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

api.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.set("Authorization", `Bearer ${accessToken}`);
  }
  return config;
});

// Paths that must never trigger the 401-refresh dance themselves, or a bad
// password / an actually-invalid refresh cookie would loop forever.
const NO_REFRESH_PATHS = ["/auth/login", "/auth/register", "/auth/refresh"];

type RetriableConfig = InternalAxiosRequestConfig & { _retry?: boolean };

// Single-flight: concurrent 401s share one in-flight refresh instead of each
// firing their own — this is what "exactly one /auth/refresh call" in the
// acceptance criteria requires.
let refreshPromise: Promise<string> | null = null;

api.interceptors.response.use(
  (res) => res,
  async (error: unknown) => {
    if (!axios.isAxiosError(error) || error.response?.status !== 401) {
      return Promise.reject(error);
    }

    const original = error.config as RetriableConfig | undefined;
    const url = original?.url ?? "";
    if (!original || original._retry || NO_REFRESH_PATHS.some((p) => url.includes(p))) {
      return Promise.reject(error);
    }
    original._retry = true;

    try {
      if (!refreshPromise) {
        // Dynamic import breaks the axios <-> store circular dependency:
        // store -> authSlice -> axios, so axios can only reach back into the
        // store lazily, at call time (well after both modules finished
        // initializing), never at module-eval time.
        refreshPromise = import("@/store").then(async ({ store }) => {
          const { refreshToken } = await import("@/store/slices/authSlice");
          const result = await store.dispatch(refreshToken()).unwrap();
          return result.access_token;
        });
      }
      const token = await refreshPromise;
      refreshPromise = null;
      original.headers.set("Authorization", `Bearer ${token}`);
      return api(original);
    } catch (refreshError) {
      refreshPromise = null;
      const { store } = await import("@/store");
      const { logout } = await import("@/store/slices/authSlice");
      await store.dispatch(logout());
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
      return Promise.reject(refreshError);
    }
  },
);
