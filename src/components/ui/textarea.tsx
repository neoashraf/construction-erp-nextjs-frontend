import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Token-driven textarea (design-system §5.1) — the multi-line sibling of Input.
 * Same field states: default `border-strong`; focus = lime accent border + soft
 * ring (`shadow-focus`); error = `destructive` (`shadow-focus-error`). Bangla-safe:
 * never clip — the box grows with content, no fixed height that truncates.
 */
export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, invalid, ...props }, ref) => (
    <textarea
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(
        "flex min-h-[74px] w-full rounded-token border border-border-strong bg-background px-3 py-2 text-sm text-foreground",
        "placeholder:text-faint transition-colors",
        "focus:border-accent focus:outline-none focus:shadow-focus",
        "disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-60",
        invalid && "border-destructive focus:border-destructive focus:shadow-focus-error",
        className,
      )}
      {...props}
    />
  ),
);
Textarea.displayName = "Textarea";
