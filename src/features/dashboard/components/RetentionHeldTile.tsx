"use client";

import { PiggyBank } from "lucide-react";
import { formatMoney } from "@/lib/money";
import { DashboardTile } from "./DashboardTile";
import { type RetentionHeldKpi, type Tile } from "../types";

export function RetentionHeldTile(props: {
  tile: Tile;
  onRefresh?: () => void;
  refreshing?: boolean;
  error?: unknown | null;
  stale?: boolean;
}) {
  const kpi = props.tile.kpi as RetentionHeldKpi;
  return (
    <DashboardTile
      tile={props.tile}
      icon={<PiggyBank className="h-4 w-4" aria-hidden />}
      onRefresh={props.onRefresh}
      refreshing={props.refreshing}
      error={props.error}
      stale={props.stale}
    >
      <div>
        <div className="text-[11.5px] text-muted-foreground">Total retention held</div>
        <div className="text-[22px] font-bold tabular-nums text-foreground">
          {formatMoney(kpi.totalRetentionHeld)}
        </div>
      </div>
    </DashboardTile>
  );
}
