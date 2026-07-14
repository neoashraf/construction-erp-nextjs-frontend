import { AlertTriangle, CheckCircle2, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Advisory over-budget badge (spec §5/§9; FR-CC-013/-014). Never blocks Save/Post —
 * the underlying CC check is consumed here purely as a hint. Text label + icon so
 * status is never colour-only.
 */
export type BudgetState = "ON" | "APPROACHING" | "OVER" | "NONE" | "UNAVAILABLE";

const CLS: Record<BudgetState, string> = {
  ON: "bg-success-soft text-success-ink",
  APPROACHING: "bg-warning-soft text-warning-ink",
  OVER: "bg-destructive-soft text-destructive-ink",
  NONE: "bg-muted text-muted-foreground",
  UNAVAILABLE: "bg-muted text-muted-foreground",
};

const LABEL: Record<BudgetState, string> = {
  ON: "On budget",
  APPROACHING: "Approaching",
  OVER: "Over budget",
  NONE: "No budget",
  UNAVAILABLE: "Budget check unavailable",
};

export function OverBudgetBadge({ state, pct }: { state: BudgetState; pct?: number }) {
  const Icon = state === "OVER" || state === "APPROACHING" ? AlertTriangle : state === "ON" ? CheckCircle2 : HelpCircle;
  const suffix = pct != null && (state === "APPROACHING" || state === "OVER") ? ` — ${pct}%` : "";
  return (
    <span
      className={cn("inline-flex items-center gap-1.5 rounded-pill px-2 py-0.5 text-[11px] font-semibold", CLS[state])}
      data-testid={`journal-over-budget-${state}`}
      title="This is advisory — you can still post."
    >
      <Icon className="h-3 w-3" aria-hidden />
      {LABEL[state]}
      {suffix}
    </span>
  );
}
