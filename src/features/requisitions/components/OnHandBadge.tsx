import { cn } from "@/lib/utils";
import { formatQty } from "@/lib/money";
import { type OnHand } from "../types";

/**
 * Per-line on-hand badge (spec §5A/§8; FR-REQ-016). Shows the current `(godown, item)` balance
 * so the Store Keeper can judge feasibility before typing. "Checking stock…" while the INV read
 * is in flight (that line's quantity input is disabled meanwhile, spec §6 partial). Turns
 * destructive when the entered quantity would exceed on-hand — text + colour, never colour alone.
 */
export function OnHandBadge({
  onHand,
  uom,
  loading,
  insufficient,
  className,
}: {
  onHand: OnHand | null;
  uom: string;
  loading: boolean;
  insufficient?: boolean;
  className?: string;
}) {
  if (loading) {
    return (
      <span
        data-testid="req-onhand-loading"
        className={cn(
          "inline-flex items-center gap-1.5 rounded-pill bg-muted px-2.5 py-1 text-[12px] font-medium text-muted-foreground",
          className,
        )}
      >
        Checking stock…
      </span>
    );
  }
  const qty = onHand ? formatQty(onHand.quantityOnHand, 4) : "0.0000";
  return (
    <span
      data-testid={insufficient ? "req-onhand-short" : "req-onhand"}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-[12px] font-medium",
        insufficient
          ? "bg-destructive-soft text-destructive-ink"
          : "bg-muted text-muted-foreground",
        className,
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 flex-none rounded-full",
          insufficient ? "bg-destructive" : "bg-muted-foreground",
        )}
        aria-hidden
      />
      {qty} {uom} on hand
    </span>
  );
}
