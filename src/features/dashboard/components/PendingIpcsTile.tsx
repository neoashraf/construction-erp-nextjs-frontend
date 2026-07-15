"use client";

import { FileText } from "lucide-react";
import { formatMoney } from "@/lib/money";
import { DashboardTile } from "./DashboardTile";
import { type PendingIpcKpi, type Tile } from "../types";

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
      icon={<FileText className="h-4 w-4" aria-hidden />}
      onRefresh={props.onRefresh}
      refreshing={props.refreshing}
      error={props.error}
      stale={props.stale}
    >
      <div className="space-y-1.5">
        <div className="text-[22px] font-bold tabular-nums text-foreground">
          {kpi.count}
          <span className="ml-2 text-[11.5px] font-normal text-muted-foreground">
            IPC{kpi.count === 1 ? "" : "s"} pending
          </span>
        </div>
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[11.5px] text-muted-foreground">Total outstanding</span>
          <span className="text-[13px] font-semibold tabular-nums text-foreground">
            {formatMoney(kpi.totalOutstanding)}
          </span>
        </div>
      </div>
    </DashboardTile>
  );
}
