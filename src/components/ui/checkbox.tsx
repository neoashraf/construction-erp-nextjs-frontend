import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Checkbox (design-system §5.1). Native input tinted with the brand accent
 * (accent-color) — accessible by default, lime when checked.
 */
export const Checkbox = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      type="checkbox"
      ref={ref}
      className={cn(
        "h-4 w-4 cursor-pointer rounded-sm border border-border-strong accent-accent",
        "focus:outline-none focus:shadow-focus",
        "disabled:cursor-not-allowed disabled:opacity-60",
        className,
      )}
      {...props}
    />
  ),
);
Checkbox.displayName = "Checkbox";
