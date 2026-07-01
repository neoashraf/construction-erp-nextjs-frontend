"use client";

import { cn } from "@/lib/utils";
import { type ProjectScope } from "../types";

/**
 * Per-permission project-scope segmented control (ALL / ASSIGNED; spec §5/§7).
 * Disabled (and forced to ALL) on an unscoped role — attempting ASSIGNED there is
 * the `ROLE_SCOPE_CONFLICT` clash (spec §6/§13), so the UI never offers it live.
 */
export function ScopeControl({
  value,
  isUnscopedRole,
  onChange,
}: {
  value: ProjectScope;
  isUnscopedRole: boolean;
  onChange: (scope: ProjectScope) => void;
}) {
  return (
    <div className="flex flex-none flex-col gap-1.5">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        Project scope
      </span>
      <div
        className={cn(
          "flex gap-0.5 rounded-token border border-border-strong bg-muted p-0.5",
          isUnscopedRole && "opacity-55",
        )}
        role="group"
        aria-label="Project scope"
      >
        <button
          type="button"
          disabled={isUnscopedRole}
          aria-pressed={value === "ALL"}
          onClick={() => onChange("ALL")}
          data-testid="scope-all"
          className={cn(
            "h-7 rounded-sm px-3.5 text-xs font-semibold transition-colors",
            value === "ALL" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground",
            isUnscopedRole ? "cursor-default" : "cursor-pointer",
          )}
        >
          All projects
        </button>
        <button
          type="button"
          disabled={isUnscopedRole}
          aria-pressed={value === "ASSIGNED"}
          onClick={() => onChange("ASSIGNED")}
          data-testid="scope-assigned"
          className={cn(
            "h-7 rounded-sm px-3.5 text-xs font-semibold transition-colors",
            value === "ASSIGNED"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground",
            isUnscopedRole ? "cursor-default" : "cursor-pointer",
          )}
        >
          Assigned only
        </button>
      </div>
    </div>
  );
}
