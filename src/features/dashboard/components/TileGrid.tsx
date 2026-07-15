"use client";

import { useState } from "react";
import { type DashboardScope, type Tile, type TileKey } from "../types";
import { useTileRefresh } from "../hooks/useDashboard";
import { AttendanceTile } from "./AttendanceTile";
import { CashFlowTile } from "./CashFlowTile";
import { LowStockTile } from "./LowStockTile";
import { OverBudgetTile } from "./OverBudgetTile";
import { PendingIpcsTile } from "./PendingIpcsTile";
import { RetentionHeldTile } from "./RetentionHeldTile";
import { TopReceivablesPayablesTile } from "./TopReceivablesPayablesTile";

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
    <div
      className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"
      data-testid="tile-grid"
    >
      {tiles.map((t) => renderTile(t, () => onRefresh(t.key), refreshingKey === t.key, errored[t.key], stale))}
    </div>
  );
}

function renderTile(
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
