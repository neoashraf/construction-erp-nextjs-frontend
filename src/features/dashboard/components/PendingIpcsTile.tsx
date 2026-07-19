"use client";

import { formatMoney } from "@/lib/money";
import { DashboardTile } from "./DashboardTile";
import { type PendingIpcKpi, type Tile } from "../types";

/**
 * FE-61 Pending IPCs — a big count with an "IPCs pending" noun, then the total
 * outstanding pinned to a divider at the tile's base. Matches the design's
 * `count` tile.
 */
export function PendingIpcsTile(props: {
  tile: Tile;
  onRefresh?: () => void;
  refreshing?: boolean;
  error?: unknown | null;
  stale?: boolean;
}) {
  const kpi = props.tile.kpi as PendingIpcKpi;
  return (
    <DashboardTile
      tile={props.tile}
      onRefresh={props.onRefresh}
      refreshing={props.refreshing}
      error={props.error}
      stale={props.stale}
    >
      <div className="flex items-baseline gap-2">
        <span className="font-mono text-[32px] font-bold leading-none tabular-nums text-foreground">
          {kpi.count}
        </span>
        <span className="text-[13px] text-muted-foreground">IPCs pending</span>
      </div>
      <div className="flex-1" />
      <div className="flex items-baseline justify-between gap-2.5 border-t border-muted pt-[11px]">
        <span className="text-[12.5px] text-muted-foreground">Total outstanding</span>
        <span className="font-mono text-[14px] font-semibold tabular-nums text-foreground">
          {formatMoney(kpi.totalOutstanding, { grouping: "lakh", fractionDigits: 2 })}
        </span>
      </div>
    </DashboardTile>
  );
}
