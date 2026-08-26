import { cn } from "@/lib/cn";

export default function Card({
  title,
  subtitle,
  action,
  padded = true,
  className,
  children,
}: {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  padded?: boolean;
  className?: string;
  children?: React.ReactNode;
}) {
  const hasHeader = title || subtitle || action;
  return (
    <div
      className={cn(
        "rounded-2xl border border-hairline bg-panel backdrop-blur-xl",
        padded && "p-5",
        className,
      )}
    >
      {hasHeader && (
        <div className={cn("flex items-start justify-between gap-4", padded ? "mb-4" : "p-5 pb-4")}>
          <div>
            {title && <h2 className="text-sm font-semibold text-text">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-xs text-text-muted">{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </div>
  );
}
