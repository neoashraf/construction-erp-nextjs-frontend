"use client";

import { DashboardTile } from "./DashboardTile";
import { type OverBudgetKpi, type Tile } from "../types";

/**
 * FE-61 Over-budget Alerts — the OVER count (destructive) beside the APPROACHING
 * count (warning), a stacked bar splitting the two, and a "lifetime to date"
 * caption. Matches the design's `overbudget` tile.
 *
 * NOTE: the design file shows "Across N cost centres" using a synthetic `total`;
 * the API contract (16-dashboard §per-tile KPI) defines this KPI as exactly
 * `{ overCount, approachingCount }` with no total (FR-DSH-004 single-source), so
 * the bar is proportioned over-vs-approaching and the caption omits the total.
 */
export function OverBudgetTile(props: {
  tile: Tile;
  onRefresh?: () => void;
  refreshing?: boolean;
  error?: unknown | null;
  stale?: boolean;
}) {
  const kpi = props.tile.kpi as OverBudgetKpi;
  const sum = kpi.overCount + kpi.approachingCount;
  const overPct = sum > 0 ? (kpi.overCount / sum) * 100 : 0;
  const apprPct = sum > 0 ? (kpi.approachingCount / sum) * 100 : 0;
  return (
    <DashboardTile
      tile={props.tile}
      onRefresh={props.onRefresh}
      refreshing={props.refreshing}
      error={props.error}
      stale={props.stale}
    >
      <div className="flex items-baseline gap-[18px]">
        <div className="flex flex-col">
          <span className="font-mono text-[26px] font-bold leading-none tabular-nums text-destructive-ink">
            {kpi.overCount}
          </span>
          <span className="mt-[3px] text-[11.5px] text-muted-foreground">over budget</span>
        </div>
        <div className="flex flex-col">
          <span className="font-mono text-[26px] font-bold leading-none tabular-nums text-warning-ink">
            {kpi.approachingCount}
          </span>
          <span className="mt-[3px] text-[11.5px] text-muted-foreground">approaching</span>
        </div>
      </div>
      <div className="mt-3 flex h-2 overflow-hidden rounded-pill bg-muted">
        <div className="bg-destructive" style={{ width: `${overPct}%` }} aria-hidden />
        <div className="bg-warning" style={{ width: `${apprPct}%` }} aria-hidden />
      </div>
      <div className="flex-1" />
      <span className="mt-2.5 text-[11px] text-faint">Lifetime to date.</span>
    </DashboardTile>
  );
}
