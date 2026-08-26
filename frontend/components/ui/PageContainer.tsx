import { cn } from "@/lib/cn";

// One deliberate set of widths, replacing the 7 accidental max-widths that
// had accreted across pages (max-w-sm/md/2xl/3xl/4xl/5xl/6xl).
const WIDTH_CLASS = {
  narrow: "max-w-md",
  default: "max-w-4xl",
  wide: "max-w-6xl",
} as const;

export default function PageContainer({
  width = "default",
  className,
  children,
}: {
  width?: keyof typeof WIDTH_CLASS;
  className?: string;
  children: React.ReactNode;
}) {
  return <div className={cn("mx-auto w-full p-6 sm:p-8", WIDTH_CLASS[width], className)}>{children}</div>;
}
