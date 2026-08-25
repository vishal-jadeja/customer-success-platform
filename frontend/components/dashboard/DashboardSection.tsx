import type { ApiError } from "@/lib/errors";

type Status = "idle" | "loading" | "succeeded" | "failed";

/**
 * Shared chrome for one dashboard section: bordered card, title, and
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
    <section className={`rounded border p-4 ${className ?? ""}`}>
      <div className="mb-3">
        <h2 className="text-sm font-semibold text-gray-600">{title}</h2>
        {subtitle && <p className="text-xs text-gray-400">{subtitle}</p>}
      </div>

      {status === "loading" && !hasData ? (
        (skeleton ?? <div className="h-24 animate-pulse rounded bg-gray-50" />)
      ) : status === "failed" ? (
        <div className="p-4 text-center text-sm text-red-600">
          {error?.message ?? "Failed to load."}{" "}
          <button type="button" className="underline" onClick={onRetry}>
            Retry
          </button>
        </div>
      ) : isEmpty ? (
        <p className="p-4 text-center text-sm text-gray-500">{emptyMessage}</p>
      ) : (
        children
      )}
    </section>
  );
}
