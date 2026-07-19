"use client";

import { formatMoney } from "@/lib/money";
import { DashboardTile } from "./DashboardTile";
import { type RetentionHeldKpi, type Tile } from "../types";

/**
 * FE-61 Retention Held — an uppercase label + a single money hero, with the
 * defect-liability caption pinned to the base. Matches the design's `money` tile.
 */
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
      onRefresh={props.onRefresh}
      refreshing={props.refreshing}
      error={props.error}
      stale={props.stale}
    >
      <span className="text-[10.5px] font-semibold uppercase tracking-[0.4px] text-faint">
        Total retention held
      </span>
      <span className="mt-[5px] font-mono text-[26px] font-bold tabular-nums tracking-[-0.01em] text-foreground">
        {formatMoney(kpi.totalRetentionHeld, { grouping: "lakh", fractionDigits: 2 })}
      </span>
      <div className="flex-1" />
      <span className="text-[11.5px] text-faint">
        Held against certified IPCs, released on defect-liability sign-off.
      </span>
    </DashboardTile>
  );
}
