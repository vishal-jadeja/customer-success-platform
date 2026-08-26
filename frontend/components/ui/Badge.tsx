import type { Tone } from "@/lib/colors";
import { cn } from "@/lib/cn";
import { TONE_CHIP_CLASS } from "@/components/ui/tone";

const SIZE_CLASS: Record<"sm" | "md", string> = {
  sm: "text-xs px-2 py-0.5 gap-1",
  md: "text-sm px-2.5 py-1 gap-1.5",
};

export default function Badge({
  tone,
  size = "sm",
  className,
  children,
}: {
  tone: Tone;
  size?: "sm" | "md";
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border font-medium whitespace-nowrap",
        TONE_CHIP_CLASS[tone],
        SIZE_CLASS[size],
        className,
      )}
    >
      {children}
    </span>
  );
}
