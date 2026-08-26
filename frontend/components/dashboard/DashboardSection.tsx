import { TriangleAlert } from "lucide-react";

import type { ApiError } from "@/lib/errors";
import Card from "@/components/ui/Card";

type Status = "idle" | "loading" | "succeeded" | "failed";

/**
 * Shared chrome for one dashboard section: glass card, title, and
 * centralised loading-skeleton / error+retry / empty-state rendering, so
 * three sections don't each reimplement it — and so one section failing
 * never blanks its siblings (each gets its own instance of this).
 */
export default function DashboardSection({
  title,
  subtitle,
  status,
  error,
  onRetry,
  isEmpty = false,
  emptyMessage,
  skeleton,
  className,
  children,
}: {
  title: string;
  subtitle?: string;
  status: Status;
  error: ApiError | null;
  onRetry: () => void;
  isEmpty?: boolean;
  emptyMessage?: string;
  skeleton?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  const hasData = !isEmpty;

  return (
    <Card title={title} subtitle={subtitle} className={className}>
      {status === "loading" && !hasData ? (
        (skeleton ?? <div className="h-24 animate-pulse rounded-lg bg-panel-strong" />)
      ) : status === "failed" ? (
        <div className="flex flex-col items-center gap-2 p-4 text-center text-sm text-warn">
          <TriangleAlert className="h-4 w-4" />
          {error?.message ?? "Failed to load."}{" "}
          <button type="button" className="text-accent hover:underline" onClick={onRetry}>
            Retry
          </button>
        </div>
      ) : isEmpty ? (
        <p className="p-4 text-center text-sm text-text-muted">{emptyMessage}</p>
      ) : (
        children
      )}
    </Card>
  );
}
