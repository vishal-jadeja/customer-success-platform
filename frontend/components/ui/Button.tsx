import { Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";

const VARIANT_CLASS = {
  primary:
    "bg-gradient-to-b from-accent to-accent-2 text-white shadow-[0_1px_0_0_rgba(255,255,255,0.15)_inset,0_8px_20px_-8px_rgba(139,92,246,0.6)] hover:brightness-110 disabled:hover:brightness-100",
  secondary: "bg-panel-strong text-text border border-hairline-strong hover:bg-panel-strong/80 hover:border-hairline-strong",
  ghost: "text-text-secondary hover:text-text hover:bg-panel",
  danger: "bg-bad-soft text-bad border border-bad/25 hover:bg-bad/20",
} as const;

const SIZE_CLASS = {
  sm: "h-8 px-3 text-sm rounded-lg gap-1.5",
  md: "h-9 px-4 text-sm rounded-lg gap-2",
} as const;

type Variant = keyof typeof VARIANT_CLASS;
type Size = keyof typeof SIZE_CLASS;

// For non-<button> elements that need the same look — e.g. a Next <Link>
// styled as a primary action.
export function buttonClass(variant: Variant = "primary", size: Size = "md", className?: string) {
  return cn(
    "inline-flex items-center justify-center font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
    VARIANT_CLASS[variant],
    SIZE_CLASS[size],
    className,
  );
}

export default function Button({
  variant = "primary",
  size = "md",
  loading = false,
  disabled,
  className,
  children,
  ...props
}: {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        VARIANT_CLASS[variant],
        SIZE_CLASS[size],
        className,
      )}
      {...props}
    >
      {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
      {children}
    </button>
  );
}
