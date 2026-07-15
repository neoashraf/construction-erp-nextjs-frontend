"use client";

import { Banknote } from "lucide-react";
import { formatMoney } from "@/lib/money";
import { DashboardTile } from "./DashboardTile";
import { type CashFlowKpi, type Tile } from "../types";

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
  return (
    <DashboardTile
      tile={tile}
      icon={<Banknote className="h-4 w-4" aria-hidden />}
      onRefresh={onRefresh}
      refreshing={refreshing}
      error={error}
      stale={stale}
    >
      <div className="space-y-1.5">
        <KpiLine label="Net cash flow" value={kpi.netInflow} />
        <KpiLine label="Cash balance" value={kpi.cashBalance} />
        <KpiLine label="Bank balance" value={kpi.bankBalance} />
      </div>
    </DashboardTile>
  );
}

function KpiLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-[11.5px] text-muted-foreground">{label}</span>
      <span className="text-[15px] font-bold tabular-nums text-foreground">
        {formatMoney(value)}
      </span>
    </div>
  );
}
