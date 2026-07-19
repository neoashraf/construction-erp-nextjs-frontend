"use client";

import Link from "next/link";
import { DashboardTile } from "./DashboardTile";
import { type LowStockKpi, type Tile, routeForReport } from "../types";

/**
 * FE-61 Low-stock Alerts — a large destructive count, the re-order caption, and a
 * "Review low-stock report →" drill link pinned to the base. Matches the design's
 * `lowstock` tile.
 */
export function LowStockTile(props: {
  tile: Tile;
  onRefresh?: () => void;
  refreshing?: boolean;
  error?: unknown | null;
  stale?: boolean;
}) {
  const kpi = props.tile.kpi as LowStockKpi;
  const href = routeForReport(props.tile.drillTo.report);
  return (
    <DashboardTile
      tile={props.tile}
      onRefresh={props.onRefresh}
      refreshing={props.refreshing}
      error={props.error}
      stale={props.stale}
    >
      <span className="font-mono text-[34px] font-bold leading-none tabular-nums text-destructive-ink">
        {kpi.count}
      </span>
      <span className="mt-2 text-[13px] leading-[1.45] text-muted-foreground">
        items at or below re-order level
      </span>
      <div className="flex-1" />
      <Link
        href={href}
        className="text-[12px] font-semibold text-accent-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        Review low-stock report →
      </Link>
    </DashboardTile>
  );
}
