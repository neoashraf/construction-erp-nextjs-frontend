"use client";

import { cn } from "@/lib/utils";

/**
 * Role-level scope-mode segmented control (design file: meta card "Scope mode"
 * radiogroup — All projects / Project-scoped). Editable for every role except the
 * built-in Admin (anti-lockout, FR-AUD-034); switching to "All projects" forces
 * every pending grid grant's project scope to ALL (the caller cascades this),
 * matching `ROLE_SCOPE_CONFLICT` prevention (spec §6/§13).
 */
export function ScopeModeControl({
  isUnscoped,
  disabled,
  onChange,
}: {
  isUnscoped: boolean;
  disabled: boolean;
  onChange: (isUnscoped: boolean) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">
        Scope mode
      </span>
      <div
        role="radiogroup"
        aria-label="Scope mode"
        title={disabled ? "The Admin role must keep full access." : undefined}
        className={cn(
          "inline-flex w-fit gap-0.5 rounded-token border border-border-strong bg-muted p-0.5",
          disabled && "opacity-55",
        )}
      >
        <button
          type="button"
          role="radio"
          aria-checked={isUnscoped}
          disabled={disabled}
          onClick={() => onChange(true)}
          data-testid="scope-mode-all"
          className={cn(
            "h-[30px] rounded-sm px-3.5 text-[12.5px] font-semibold transition-colors",
            isUnscoped ? "bg-background text-foreground shadow-sm" : "text-muted-foreground",
            disabled ? "cursor-default" : "cursor-pointer",
          )}
        >
          All projects
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={!isUnscoped}
          disabled={disabled}
          onClick={() => onChange(false)}
          data-testid="scope-mode-scoped"
          className={cn(
            "h-[30px] rounded-sm px-3.5 text-[12.5px] font-semibold transition-colors",
            !isUnscoped ? "bg-background text-foreground shadow-sm" : "text-muted-foreground",
            disabled ? "cursor-default" : "cursor-pointer",
          )}
        >
          Project-scoped
        </button>
      </div>
    </div>
  );
}
