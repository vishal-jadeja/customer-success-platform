import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";
import { inputClass } from "@/components/ui/Input";

const Select = ({
  className,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) => (
  <div className="relative">
    <select
      className={cn(inputClass, "appearance-none pr-8", className)}
      {...props}
    >
      {children}
    </select>
    <ChevronDown className="pointer-events-none absolute top-1/2 right-2.5 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" />
  </div>
);

export default Select;
