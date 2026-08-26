import { cn } from "@/lib/cn";
import { inputClass } from "@/components/ui/Input";

const Textarea = ({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => (
  <textarea className={cn(inputClass, "resize-y", className)} {...props} />
);

export default Textarea;
