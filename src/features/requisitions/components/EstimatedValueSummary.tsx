"use client";

import { formatMoney } from "@/lib/money";
import { OverBudgetBadge } from "./OverBudgetBadge";
import { type BudgetStatus } from "../types";

/**
 * Estimated-value + over-budget summary (spec §4/§5; FR-REQ-005). The `৳` total of all line
 * values, shown as "Estimating…" until every line rate resolves (never a stale total). The
 * CC advisory over-budget badge sits beside it — advisory only, never blocks Save/Submit.
 * Rendered inline at ≥lg and inside the sticky bottom bar on mobile.
 */
export function EstimatedValueSummary({
  estimatedValue,
  estimating,
  budgetStatus,
  compact,
}: {
  estimatedValue: string | null;
  estimating: boolean;
  budgetStatus: BudgetStatus | undefined;
  compact?: boolean;
}) {
  return (
    <div className="flex items-center gap-3" data-testid="req-estimate">
      <div>
        <div className="text-[10.5px] font-semibold uppercase tracking-[0.4px] text-muted-foreground">Estimated total</div>
        <div className={compact ? "font-mono text-[16px] font-semibold tabular-nums text-foreground" : "font-mono text-[20px] font-semibold tabular-nums text-foreground"}>
          {estimating ? (
            <span className="text-faint" data-testid="req-estimating">Estimating…</span>
          ) : estimatedValue != null ? (
            formatMoney(estimatedValue)
          ) : (
            <span className="text-faint">—</span>
          )}
        </div>
      </div>
      <OverBudgetBadge status={budgetStatus} />
    </div>
  );
}
