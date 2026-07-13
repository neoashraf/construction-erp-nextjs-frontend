"use client";

import { cn } from "@/lib/utils";
import { formatQty } from "@/lib/money";
import { type StockLedgerRow } from "../types";

/**
 * On-hand badge next to the quantity field (FR-INV-001; spec §5/§6). Shows the current
 * `(godown, item)` balance so the Store Keeper sees available stock before submitting.
 * "Checking stock…" while the ledger read loads (partial state, never blocks the form);
 * a muted "Might be outdated" note when offline (spec §6). Negative-triggering quantities
 * are flagged separately by the screen's warning banner (§13 edge 1).
 */
export function OnHandBadge({
  balance,
  loading,
  offline,
  uom,
  godownName,
}: {
  balance: StockLedgerRow | null | undefined;
  loading: boolean;
  offline: boolean;
  uom: string;
  godownName: string;
}) {
  if (loading) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-pill bg-muted px-3 py-1 text-[12.5px] text-muted-foreground" data-testid="sj-onhand-loading">
        Checking stock…
      </span>
    );
  }
  const qty = balance ? formatQty(balance.quantityOnHand) : "0";
  return (
    <span
      className={cn("inline-flex items-center gap-1.5 rounded-pill px-3 py-1 text-[12.5px] font-medium", "bg-success-soft text-success-ink")}
      data-testid="sj-onhand"
    >
      <span className="h-1.5 w-1.5 rounded-full bg-success" aria-hidden />
      {qty} {uom} on hand{godownName ? ` at ${godownName}` : ""}
      {offline && <span className="ml-1 text-warning-ink">· might be outdated — you&apos;re offline</span>}
    </span>
  );
}
