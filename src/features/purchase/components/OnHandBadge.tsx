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

  let label: string;
  let value: string | null = null;
  if (!ready) {
    label = "On-hand —";
  } else if (q.isLoading) {
    label = "Checking…";
  } else if (q.isError) {
    label = "On-hand —";
  } else if (!q.data) {
    label = uom ? `On-hand 0 ${uom}` : "On-hand 0";
  } else {
    const qty = Number(q.data.quantityOnHand ?? "0").toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 3,
    });
    label = uom ? `On-hand ${qty} ${uom}` : `On-hand ${qty}`;
    value = q.data.totalValue ? formatMoney(q.data.totalValue) : null;
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-pill bg-accent-soft/60 px-2.5 py-0.5 text-[11.5px] font-semibold text-accent-ink",
        className,
      )}
      title={value ? `${label} · ${value}` : undefined}
      aria-label={`On-hand: ${label.replace("On-hand ", "")}`}
      data-testid="grn-on-hand"
    >
      <Database className="h-3 w-3" aria-hidden />
      {label}
      {value && (
        <span className="font-mono tabular-nums text-accent-ink/80" data-testid="grn-on-hand-value">
          · {value}
        </span>
      )}
    </span>
  );
}
