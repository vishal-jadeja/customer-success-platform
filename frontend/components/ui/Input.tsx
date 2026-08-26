import { cn } from "@/lib/cn";

const fieldClass =
  "w-full rounded-lg border border-hairline-strong bg-raised/60 px-3 py-2 text-sm text-text placeholder:text-text-muted transition-colors focus:border-accent focus:outline-none disabled:cursor-not-allowed disabled:opacity-50";

export const inputClass = fieldClass;

const Input = ({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input className={cn(fieldClass, className)} {...props} />
);

export default Input;
