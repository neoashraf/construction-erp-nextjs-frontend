"use client";

import { AlertTriangle } from "lucide-react";
import { DashboardTile } from "./DashboardTile";
import { type OverBudgetKpi, type Tile } from "../types";

export function OverBudgetTile(props: {
  tile: Tile;
  onRefresh?: () => void;
  refreshing?: boolean;
  error?: unknown | null;
  stale?: boolean;
}) {
  const kpi = props.tile.kpi as OverBudgetKpi;
  return (
    <DashboardTile
      tile={props.tile}
      icon={<AlertTriangle className="h-4 w-4" aria-hidden />}
      onRefresh={props.onRefresh}
      refreshing={props.refreshing}
      error={props.error}
      stale={props.stale}
    >
      <div className="space-y-1.5">
        <div className="flex items-baseline gap-4">
          <div>
            <div className="text-[22px] font-bold tabular-nums text-destructive">
              {kpi.overCount}
            </div>
            <div className="text-[11.5px] text-muted-foreground">over budget</div>
          </div>
          <div>
            <div className="text-[22px] font-bold tabular-nums text-warning-ink">
              {kpi.approachingCount}
            </div>
            <div className="text-[11.5px] text-muted-foreground">approaching</div>
          </div>
        </div>
        <p className="text-[10.5px] text-muted-foreground">Lifetime to date.</p>
      </div>
    </DashboardTile>
  );
}
