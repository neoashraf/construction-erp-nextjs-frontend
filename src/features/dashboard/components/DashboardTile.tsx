"use client";

import Link from "next/link";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { asApiError } from "@/lib/api/errors";
import { type Tile, type TileStatus, routeForReport } from "../types";
import { tileMeta } from "../tile-meta";
import { TileStatusBadge } from "./TileStatusBadge";

/**
 * FE-61 DashboardTile — the shared KPI card shell, matching the dashboard design
 * file (docs/design/design-files/16-dashboard/Dashboard.dc.html). Header row:
 * per-module tint chip + title link + optional status badge + a tile-scoped
 * refresh. Body: the per-KPI children. Footer: an "As of …" caption (left) and a
 * "View report →" drill-through (right).
 */
export function DashboardTile({
  tile,
  status,
  children,
  onRefresh,
  refreshing = false,
  error = null,
  stale = false,
  className,
}: {
  tile: Tile;
  status?: TileStatus;
  children: React.ReactNode;
  onRefresh?: () => void;
  refreshing?: boolean;
  error?: unknown | null;
  stale?: boolean;
  className?: string;
}) {
  const href = drillHref(tile);
  const meta = tileMeta(tile.key);
  return (
    <Card
      role="region"
      aria-label={tile.title}
      className={cn(
        "flex min-h-[172px] flex-col rounded-lg border-border transition-shadow hover:border-border-hover hover:shadow-md",
        stale && "opacity-60",
        className,
      )}
      data-testid={`tile-${tile.key}`}
    >
      {/* header row */}
      <div className="flex items-center gap-2.5 px-3.5 pt-3.5">
        <span
          className={cn(
            "flex h-[26px] w-[26px] flex-none items-center justify-center rounded-md text-[10px] font-bold",
            meta.chip,
          )}
          aria-hidden
        >
          {meta.glyph}
        </span>
        <Link
          href={href}
          className="min-w-0 flex-1 truncate text-[13px] font-semibold text-foreground hover:text-accent-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          data-testid={`tile-${tile.key}-title`}
        >
          {tile.title}
        </Link>
        <TileStatusBadge status={status ?? tile.status} />
        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing || stale}
            aria-label={`Refresh ${tile.title}`}
            className={cn(
              "flex h-7 w-7 flex-none items-center justify-center rounded-md border border-border-strong bg-background text-muted-foreground hover:border-border-hover hover:bg-surface-2 hover:text-foreground",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
              "disabled:cursor-not-allowed disabled:opacity-60",
            )}
            data-testid={`tile-${tile.key}-refresh`}
          >
            <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} aria-hidden />
          </button>
        )}
      </div>

      {/* body */}
      {error ? (
        <div className="flex-1 px-3.5 pt-3.5">
          <TileErrorInline onRetry={onRefresh} error={error} />
        </div>
      ) : refreshing ? (
        <TileRefreshingSkeleton />
      ) : (
        <div className="flex flex-1 flex-col p-3.5" aria-live="polite" data-testid={`tile-${tile.key}-body`}>
          {children}
        </div>
      )}

      {/* footer caption */}
      <div className="flex items-center justify-between gap-2.5 px-3.5 pb-3">
        <span className="whitespace-nowrap text-[10.5px] text-faint">
          As of {formatAsOf(tile.generatedAt)}
        </span>
        <Link
          href={href}
          className="whitespace-nowrap text-[11px] font-semibold text-muted-foreground hover:text-accent-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          data-testid={`tile-${tile.key}-drill`}
          aria-label={`View report for ${tile.title}`}
        >
          View report →
        </Link>
      </div>
    </Card>
  );
}

/** Body skeleton while a single tile re-fetches (design: pulse bars). */
function TileRefreshingSkeleton() {
  return (
    <div className="flex flex-1 flex-col gap-3 p-3.5">
      <div className="h-6 w-[58%] animate-pulse rounded-md bg-muted" />
      <div className="h-[11px] w-[82%] animate-pulse rounded bg-muted" />
      <div className="h-[11px] w-[54%] animate-pulse rounded bg-muted" />
    </div>
  );
}

function TileErrorInline({
  onRetry,
  error,
}: {
  onRetry?: () => void;
  error: unknown;
}) {
  const apiErr = asApiError(error);
  const forbidden = apiErr.status === 403;
  return (
    <div
      className="rounded-md border border-destructive-soft bg-destructive-soft/30 p-3"
      data-testid="tile-error-inline"
    >
      <p className="text-[12.5px] font-semibold text-destructive-ink">
        {forbidden ? "You don't have permission to view this tile." : `Couldn't load this tile.`}
      </p>
      {!forbidden && onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry} className="mt-2 h-8" data-testid="tile-error-retry">
          Retry
        </Button>
      )}
    </div>
  );
}

function drillHref(tile: Tile): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(tile.drillTo.params ?? {})) {
    if (v !== null && v !== undefined) q.set(k, String(v));
  }
  const base = routeForReport(tile.drillTo.report);
  const suffix = q.toString();
  return suffix ? `${base}?${suffix}` : base;
}

/** "14:30, 11/07/2026" — HH:mm then DD/MM/YYYY, matching the design caption. */
function formatAsOf(iso: string): string {
  try {
    const d = new Date(iso);
    const dd = String(d.getUTCDate()).padStart(2, "0");
    const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
    const yyyy = d.getUTCFullYear();
    const hh = String(d.getUTCHours()).padStart(2, "0");
    const min = String(d.getUTCMinutes()).padStart(2, "0");
    return `${hh}:${min}, ${dd}/${mm}/${yyyy}`;
  } catch {
    return iso;
  }
}
