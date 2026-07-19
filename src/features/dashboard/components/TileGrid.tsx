"use client";

import { useState } from "react";
import { type DashboardScope, type Tile, type TileKey } from "../types";
import { useTileRefresh } from "../hooks/useDashboard";
import { AttendanceTile } from "./AttendanceTile";
import { CashFlowTile } from "./CashFlowTile";
import { CompactTile } from "./CompactTile";
import { LowStockTile } from "./LowStockTile";
import { OverBudgetTile } from "./OverBudgetTile";
import { PendingIpcsTile } from "./PendingIpcsTile";
import { RetentionHeldTile } from "./RetentionHeldTile";
import { TopReceivablesPayablesTile } from "./TopReceivablesPayablesTile";

/**
 * FE-61 tile grid — three responsive renderings matching the design file's three
 * frames: the rich per-KPI desktop tiles at ≥1024 (3-col), the compact tablet
 * tiles at 768–1023 (2-col), and the compact mobile tiles below 768 (1-col, with
 * the full-width "View report" + labelled "Refresh" action row). Only one grid is
 * visible per breakpoint; the others are display-hidden (a11u tree carries them
 * but the visible one owns the interactions).
 */
export function TileGrid({
  tiles,
  scope,
  stale = false,
}: {
  tiles: Tile[];
  scope: DashboardScope;
  stale?: boolean;
}) {
  const refresh = useTileRefresh(scope);
  const [errored, setErrored] = useState<Record<string, unknown>>({});
  const [refreshingKey, setRefreshingKey] = useState<TileKey | null>(null);

  async function onRefresh(key: TileKey) {
    setRefreshingKey(key);
    setErrored((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    try {
      await refresh.mutateAsync(key);
    } catch (err) {
      setErrored((prev) => ({ ...prev, [key]: err }));
    } finally {
      setRefreshingKey(null);
    }
  }

  return (
    <>
      {/* ≥1024 — rich per-KPI desktop tiles */}
      <div className="hidden gap-4 lg:grid lg:grid-cols-3" data-testid="tile-grid">
        {tiles.map((t) =>
          renderFullTile(t, () => onRefresh(t.key), refreshingKey === t.key, errored[t.key], stale),
        )}
      </div>

      {/* 768–1023 — compact tablet tiles, 2-col */}
      <div className="hidden gap-4 md:grid md:grid-cols-2 lg:hidden" aria-hidden data-testid="tile-grid-tablet">
        {tiles.map((t) => (
          <CompactTile
            key={t.key}
            tile={t}
            variant="tablet"
            onRefresh={() => onRefresh(t.key)}
            refreshing={refreshingKey === t.key}
            stale={stale}
          />
        ))}
      </div>

      {/* <768 — compact mobile tiles, stacked */}
      <div className="grid grid-cols-1 gap-2.5 md:hidden" aria-hidden data-testid="tile-grid-mobile">
        {tiles.map((t) => (
          <CompactTile
            key={t.key}
            tile={t}
            variant="mobile"
            onRefresh={() => onRefresh(t.key)}
            refreshing={refreshingKey === t.key}
            stale={stale}
          />
        ))}
      </div>
    </>
  );
}

function renderFullTile(
  tile: Tile,
  onRefresh: () => void,
  refreshing: boolean,
  error: unknown | undefined,
  stale: boolean,
) {
  const shared = { onRefresh, refreshing, error: error ?? null, stale };
  switch (tile.key) {
    case "project-cash-flow":
      return <CashFlowTile key={tile.key} tile={tile} {...shared} />;
    case "pending-ipcs":
      return <PendingIpcsTile key={tile.key} tile={tile} {...shared} />;
    case "retention-held":
      return <RetentionHeldTile key={tile.key} tile={tile} {...shared} />;
    case "low-stock":
      return <LowStockTile key={tile.key} tile={tile} {...shared} />;
    case "over-budget":
      return <OverBudgetTile key={tile.key} tile={tile} {...shared} />;
    case "attendance-summary":
      return <AttendanceTile key={tile.key} tile={tile} {...shared} />;
    case "top-receivables-payables":
      return <TopReceivablesPayablesTile key={tile.key} tile={tile} {...shared} />;
    default:
      return null;
  }
}
