"use client";

import { DashboardTile } from "./DashboardTile";
import { type AttendanceKpi, type Tile } from "../types";

/**
 * FE-61 Attendance Summary — a teal period pill over two big-number columns:
 * present-days and total head-count (a decimal, since daily-labour head-count can
 * be fractional). Matches the design's `attendance` tile.
 */
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
      onRefresh={props.onRefresh}
      refreshing={props.refreshing}
      error={props.error}
      stale={props.stale}
    >
      <span className="inline-flex h-[22px] items-center self-start rounded-md bg-teal-soft px-2.5 text-[11.5px] font-semibold text-teal-ink">
        {formatMonth(kpi.period)}
      </span>
      <div className="mt-3 flex items-end gap-[22px]">
        <StatColumn value={String(kpi.presentDays)} label="Present days" />
        <StatColumn value={formatHeadCount(kpi.headCountTotal)} label="Total head count" />
      </div>
    </DashboardTile>
  );
}

function StatColumn({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col">
      <span className="font-mono text-[26px] font-bold leading-none tabular-nums text-foreground">
        {value}
      </span>
      <span className="mt-[3px] text-[11.5px] text-muted-foreground">{label}</span>
    </div>
  );
}

/** Head-count can be fractional (daily-labour); the design shows one decimal. */
function formatHeadCount(v: string): string {
  const n = Number(v);
  return Number.isFinite(n) ? n.toFixed(1) : v;
}

function formatMonth(ym: string): string {
  const [y, m] = ym.split("-");
  if (!y || !m) return ym;
  const idx = Math.max(0, Math.min(11, Number(m) - 1));
  const names = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  return `${names[idx]} ${y}`;
}
