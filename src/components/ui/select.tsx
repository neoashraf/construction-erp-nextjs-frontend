import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Styled native select (design-system §5.1). Same lime focus as Input. For
 * searchable/async pickers (party, account, project) a Combobox comes later; this
 * covers fixed option sets. Bangla-safe; never clip option text.
 */
export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, invalid, children, ...props }, ref) => (
    <div className="relative">
      <select
        ref={ref}
        aria-invalid={invalid || undefined}
        className={cn(
          "h-9 w-full appearance-none rounded-token border border-border-strong bg-background pl-3 pr-9 text-sm text-foreground",
          "focus:border-accent focus:outline-none focus:ring-[3px] focus:ring-accent-soft",
          "disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-60",
          invalid && "border-destructive focus:border-destructive focus:ring-destructive-soft",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
    </div>
  ),
);
Select.displayName = "Select";
