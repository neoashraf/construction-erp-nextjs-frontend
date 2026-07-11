"use client";

import { cn } from "@/lib/utils";
import { PROFIT_GROUP_BY, GROUP_BY_LABEL } from "../schemas/profitability.schema";
import { type ProfitGroupBy } from "../types";

/**
 * "By cost centre" / "By project" / "By project & cost centre" grouping control
 * (FR-CC-009; spec §3/§5/§10). A proper `role="radiogroup"` — switching re-queries with
 * the new `groupBy`; the screen keeps still-applicable project/cost-centre filters across
 * modes. Disabled while the first load resolves (spec §6 loading).
 */
export function GroupingModeControl({
  value,
  disabled,
  onChange,
}: {
  value: ProfitGroupBy;
  disabled?: boolean;
  onChange: (mode: ProfitGroupBy) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Group by"
      className="inline-flex rounded-token bg-muted p-0.5"
      data-testid="profit-group-mode"
    >
      {PROFIT_GROUP_BY.map((m) => {
        const active = m === value;
        return (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            onClick={() => onChange(m)}
            data-testid={`profit-mode-${m}`}
            className={cn(
              "h-8 rounded-[6px] px-3 text-xs font-semibold transition-colors disabled:opacity-60",
              "focus-visible:outline-none focus-visible:shadow-focus",
              active ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {GROUP_BY_LABEL[m]}
          </button>
        );
      })}
    </div>
  );
}
