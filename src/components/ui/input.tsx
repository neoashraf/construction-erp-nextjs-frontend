import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Token-driven text input (design-system §5.1). Default = border-strong; FOCUS shows
 * the brand lime accent border + soft ring (the active-field look); the default
 * outline is suppressed on fields. Error state uses destructive. Bangla-safe: the
 * height must never clip Bangla — don't hard-code colours/heights elsewhere.
 */
export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, invalid, ...props }, ref) => (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      // Password managers / Grammarly / etc. inject attributes (data-lastpass-icon-root,
      // data-gramm, data-1p-*) into fields BEFORE React hydrates — a descendant of
      // <body>, so the layout's suppression doesn't reach here. Scoped to this element's
      // own attributes only (does not cascade), so real value mismatches still surface.
      suppressHydrationWarning
      className={cn(
        "flex h-9 w-full rounded-token border border-border-strong bg-background px-3 text-sm text-foreground",
        "placeholder:text-faint transition-colors",
        "focus:border-accent focus:outline-none focus:shadow-focus",
        "disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-60",
        invalid &&
          "border-destructive focus:border-destructive focus:shadow-focus-error",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";
