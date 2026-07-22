"use client";

import { cn } from "@/lib/utils";
import { type Scope } from "../types";

/**
 * FE-55 Consolidated / Project-wise segmented toggle (spec §3/§9). Radiogroup
 * semantics for a11y; the parent hoists the choice + drives the projectId /
 * groupBy behaviour off it.
 */
const OPTIONS: Array<{ id: Scope; label: string; hint: string }> = [
  { id: "CONSOLIDATED", label: "Consolidated", hint: "Whole company" },
  { id: "PROJECT_WISE", label: "Project-wise", hint: "Filtered / grouped by project" },
];

export function ScopeToggle({
  value,
  onChange,
}: {
  value: Scope;
  onChange: (scope: Scope) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Statement scope"
      className="inline-flex overflow-hidden rounded-token border border-border-strong"
      data-testid="statement-scope"
    >
      {OPTIONS.map((o) => {
        const active = o.id === value;
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.id)}
            className={cn(
              "px-3.5 py-1.5 text-[12.5px] font-semibold transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
              active
                ? "bg-primary text-primary-foreground"
                : "bg-surface text-muted-foreground hover:bg-canvas",
            )}
            title={o.hint}
            data-testid={`scope-${o.id}`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
