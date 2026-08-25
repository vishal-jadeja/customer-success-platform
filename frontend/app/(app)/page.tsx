import { redirect } from "next/navigation";

// Server component: no flash of placeholder content before the redirect
// fires. AuthGuard (the parent (app) layout) still protects /dashboard
// itself — this route has nothing to guard on its own.
export default function AppHomePage() {
  redirect("/dashboard");
}
