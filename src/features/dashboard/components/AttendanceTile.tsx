"use client";

import { Users } from "lucide-react";
import { DashboardTile } from "./DashboardTile";
import { type AttendanceKpi, type Tile } from "../types";

export function AttendanceTile(props: {
  tile: Tile;
  onRefresh?: () => void;
  refreshing?: boolean;
  error?: unknown | null;
  stale?: boolean;
}) {
  const kpi = props.tile.kpi as AttendanceKpi;
  return (
    <DashboardTile
      tile={props.tile}
      icon={<Users className="h-4 w-4" aria-hidden />}
      onRefresh={props.onRefresh}
      refreshing={props.refreshing}
      error={props.error}
      stale={props.stale}
    >
      <div className="space-y-1.5">
        <div className="text-[11.5px] uppercase tracking-wide text-muted-foreground">
          Period {formatMonth(kpi.period)}
        </div>
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[11.5px] text-muted-foreground">Present days</span>
          <span className="text-[15px] font-bold tabular-nums text-foreground">
            {kpi.presentDays}
          </span>
        </div>
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[11.5px] text-muted-foreground">Total head count</span>
          <span className="text-[15px] font-bold tabular-nums text-foreground">
            {Number(kpi.headCountTotal).toFixed(2)}
          </span>
        </div>
      </div>
    </DashboardTile>
  );
}

function formatMonth(ym: string): string {
  const [y, m] = ym.split("-");
  if (!y || !m) return ym;
  const idx = Math.max(0, Math.min(11, Number(m) - 1));
  const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${names[idx]} ${y}`;
}
