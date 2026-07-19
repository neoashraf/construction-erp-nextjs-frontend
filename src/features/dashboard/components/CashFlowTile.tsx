"use client";

import Decimal from "decimal.js";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import { DashboardTile } from "./DashboardTile";
import { type CashFlowKpi, type Tile } from "../types";

/**
 * FE-61 Project Cash Flow — a signed hero "Net cash flow" figure (green when
 * positive, destructive when negative) over a divider with the cash + bank
 * balances. Matches the design file's `cashflow` tile.
 */
export function CashFlowTile({
  tile,
  onRefresh,
  refreshing,
  error,
  stale,
}: {
  tile: Tile;
  onRefresh?: () => void;
  refreshing?: boolean;
  error?: unknown | null;
  stale?: boolean;
}) {
  const kpi = tile.kpi as CashFlowKpi;
  const net = new Decimal(kpi.netInflow);
  const negative = net.isNegative();
  const netStr =
    (negative ? "− " : "+ ") + formatMoney(net.abs(), { grouping: "lakh", fractionDigits: 2 });
  return (
    <DashboardTile
      tile={tile}
      onRefresh={onRefresh}
      refreshing={refreshing}
      error={error}
      stale={stale}
    >
      <div className="flex flex-col gap-1">
        <span className="text-[10.5px] font-semibold uppercase tracking-[0.4px] text-faint">
          Net cash flow
        </span>
        <span
          className={cn(
            "font-mono text-[23px] font-bold tabular-nums tracking-[-0.01em]",
            negative ? "text-destructive-ink" : "text-success-ink",
          )}
        >
          {netStr}
        </span>
      </div>
      <div className="mt-3 flex flex-col gap-2 border-t border-muted pt-[11px]">
        <BalanceLine label="Cash balance" value={kpi.cashBalance} />
        <BalanceLine label="Bank balance" value={kpi.bankBalance} />
      </div>
    </DashboardTile>
  );
}

function BalanceLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2.5">
      <span className="text-[12.5px] text-muted-foreground">{label}</span>
      <span className="font-mono text-[13px] font-semibold tabular-nums text-foreground">
        {formatMoney(value, { grouping: "lakh", fractionDigits: 2 })}
      </span>
    </div>
  );
}
