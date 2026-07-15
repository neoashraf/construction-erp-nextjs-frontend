"use client";

import { PackageMinus } from "lucide-react";
import { DashboardTile } from "./DashboardTile";
import { type LowStockKpi, type Tile } from "../types";

export function LowStockTile(props: {
  tile: Tile;
  onRefresh?: () => void;
  refreshing?: boolean;
  error?: unknown | null;
  stale?: boolean;
}) {
  const kpi = props.tile.kpi as LowStockKpi;
  return (
    <DashboardTile
      tile={props.tile}
      icon={<PackageMinus className="h-4 w-4" aria-hidden />}
      onRefresh={props.onRefresh}
      refreshing={props.refreshing}
      error={props.error}
      stale={props.stale}
    >
      <div>
        <div className="text-[22px] font-bold tabular-nums text-foreground">
          {kpi.count}
        </div>
        <div className="text-[11.5px] text-muted-foreground">
          item{kpi.count === 1 ? "" : "s"} at or below re-order level
        </div>
      </div>
    </DashboardTile>
  );
}
