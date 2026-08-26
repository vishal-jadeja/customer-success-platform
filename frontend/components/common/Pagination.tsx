"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

export default function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;

  return (
    <div className="mt-4 flex items-center justify-between text-sm">
      <span className="text-text-muted">
        Page <span className="font-mono tabular-nums">{page}</span> of{" "}
        <span className="font-mono tabular-nums">{totalPages}</span> ·{" "}
        <span className="font-mono tabular-nums">{total}</span> total
      </span>
      <div className="flex gap-2">
        <button
          type="button"
          className="flex items-center gap-1 rounded-lg border border-hairline-strong px-3 py-1.5 text-text-secondary transition-colors hover:bg-panel-strong disabled:opacity-40 disabled:hover:bg-transparent"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Previous
        </button>
        <button
          type="button"
          className="flex items-center gap-1 rounded-lg border border-hairline-strong px-3 py-1.5 text-text-secondary transition-colors hover:bg-panel-strong disabled:opacity-40 disabled:hover:bg-transparent"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Next
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
