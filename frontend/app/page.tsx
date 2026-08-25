"use client";

import { FormEvent, useState } from "react";

/**
 * Minimal Phase 03 deploy-verification skeleton: no store, no guard, no UI
 * system — just proof that login -> /auth/me works end-to-end through the
 * same-origin proxy (so the refresh cookie lands first-party on this origin).
 * The real login page/store/guard land in Phase 08.
 */
export default function Home() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<string>("");
  const [me, setMe] = useState<string>("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus("Logging in…");
    setMe("");
    try {
      const loginRes = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const loginBody = await loginRes.json();
      if (!loginRes.ok) {
        setStatus(`Login failed: ${loginBody?.error?.message ?? loginRes.status}`);
        return;
      }
      setStatus("Logged in. Calling /auth/me…");

      const meRes = await fetch("/api/v1/auth/me", {
        headers: { authorization: `Bearer ${loginBody.access_token}` },
      });
      const meBody = await meRes.json();
      if (!meRes.ok) {
        setStatus(`/auth/me failed: ${meBody?.error?.message ?? meRes.status}`);
        return;
      }
      setStatus("OK");
      setMe(JSON.stringify(meBody, null, 2));
    } catch (err) {
      setStatus(`Network error: ${String(err)}`);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 p-8">
      <h1 className="text-xl font-semibold">CSP — deploy check</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <input
          className="rounded border px-3 py-2"
          type="email"
          placeholder="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          className="rounded border px-3 py-2"
          type="password"
          placeholder="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button className="rounded bg-black px-3 py-2 text-white" type="submit">
          Login
        </button>
      </form>
      <p className="text-sm text-gray-600">{status}</p>
      {me && <pre className="overflow-auto rounded bg-gray-100 p-3 text-xs">{me}</pre>}
    </main>
  );
}
