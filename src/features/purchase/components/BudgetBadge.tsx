import { Badge } from "@/components/ui/badge";
import { type BudgetStatus } from "../types";

/**
 * Advisory over-budget badge (FR-PUR-019; FR-CC-013/-014). NEVER blocks Save or Approve —
 * this is a soft hint surfaced from `meta.budgetWarnings`. Announced via `aria-live="polite"`
 * on change (brief §Scope 13; spec §10). Text + dot, never colour-only. Shared with
 * fe-purchase-bills for a consistent look.
 */
const TONE: Record<BudgetStatus, "success" | "warning" | "destructive" | "neutral"> = {
  OK: "success",
  APPROACHING: "warning",
  OVER: "destructive",
  UNBUDGETED: "neutral",
};

const LABEL: Record<BudgetStatus, string> = {
  OK: "Within budget",
  APPROACHING: "Nearing budget",
  OVER: "Over budget",
  UNBUDGETED: "No budget set",
};

export function BudgetBadge({ status, className }: { status: BudgetStatus; className?: string }) {
  return (
    <Badge tone={TONE[status]} dot className={className} data-testid={`po-budget-${status}`}>
      {LABEL[status]}
    </Badge>
  );
}
