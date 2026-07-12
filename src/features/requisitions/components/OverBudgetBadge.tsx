import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { type BudgetStatus } from "../types";

/**
 * CC advisory over-budget badge (FR-REQ-005; SRS edge 11; CC FR-CC-014). **Advisory only —
 * never blocks Save/Submit.** Text label + colour + icon (never colour alone, spec §10),
 * with the heads-up tooltip. Renders nothing for `OK`. Shared with the sibling REQ screens.
 */
export function OverBudgetBadge({ status, className }: { status: BudgetStatus | undefined; className?: string }) {
  if (!status || status === "OK") return null;
  const over = status === "OVER";
  return (
    <span
      data-testid={`req-budget-${status}`}
      title="This is a heads-up only — you can still submit."
      className={cn(
        "inline-flex items-center gap-1.5 rounded-pill px-2.5 py-0.5 text-xs font-semibold",
        over ? "bg-destructive-soft text-destructive-ink" : "bg-warning-soft text-warning-ink",
        className,
      )}
    >
      <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
      {over ? "Over budget" : "Approaching budget"}
    </span>
  );
}
