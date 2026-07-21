"use client";

import { Database } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/money";
import { useOnHand } from "../hooks/useOnHand";

/**
 * Live per-(godown, item) on-hand snapshot behind the GRN line (brief §Scope 4;
 * spec §5/§9). Informational only, NEVER a validation gate — a rare `NEGATIVE_STOCK`
 * from INV surfaces generically at Post. Shows `On-hand {qty} {uom}` (+ tooltip
 * value on hover); "Checking…" while loading; muted "—" when either id is empty.
 * `aria-label` names the axis so screen readers hear the full context.
 */
export function OnHandBadge({
  godownId,
  itemId,
  uom,
  className,
}: {
  godownId: string;
  itemId: string;
  uom?: string;
  className?: string;
}) {
  const q = useOnHand(godownId, itemId);
  const ready = !!godownId && !!itemId;

  // `checking` renders just the "Checking…" text; otherwise a muted "On-hand"
  // prefix + a bold qty (design "GRN and matching.dc.html" on-hand strip).
  let checking = false;
  let qtyText: string;
  let value: string | null = null;
  if (!ready) {
    qtyText = "—";
  } else if (q.isLoading) {
    checking = true;
    qtyText = "";
  } else if (q.isError) {
    qtyText = "—";
  } else if (!q.data) {
    qtyText = uom ? `0 ${uom}` : "0";
  } else {
    const qty = Number(q.data.quantityOnHand ?? "0").toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 3,
    });
    qtyText = uom ? `${qty} ${uom}` : qty;
    value = q.data.totalValue ? formatMoney(q.data.totalValue) : null;
  }

  const ariaText = checking ? "Checking…" : qtyText;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-token bg-muted px-2.5 py-1.5 text-[11.5px] text-muted-foreground",
        className,
      )}
      title={value ? `On-hand ${qtyText} · ${value}` : undefined}
      aria-label={`On-hand: ${ariaText}`}
      data-testid="grn-on-hand"
    >
      <Database className="h-3.5 w-3.5 text-teal" aria-hidden />
      {checking ? (
        <span>Checking…</span>
      ) : (
        <span>
          On-hand{" "}
          <span className="font-semibold tabular-nums text-foreground">{qtyText}</span>
        </span>
      )}
      {value && (
        <span className="tabular-nums text-muted-foreground" data-testid="grn-on-hand-value">
          · {value}
        </span>
      )}
    </span>
  );
}
