"use client";

import Link from "next/link";
import { ArrowRight, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { asApiError } from "@/lib/api/errors";
import { type Tile, type TileStatus, routeForReport } from "../types";
import { TileStatusBadge } from "./TileStatusBadge";

/**
 * FE-61 DashboardTile — the shared card shell used by every KPI. Header
 * carries an icon chip + title + refresh; footer has the "Generated at"
 * caption + drill-through affordance. Body is per-KPI children.
 */
export function DashboardTile({
  tile,
  icon,
  status,
  children,
  onRefresh,
  refreshing = false,
  error = null,
  stale = false,
}: {
  tile: Tile;
  icon: React.ReactNode;
  status?: TileStatus;
  children: React.ReactNode;
  onRefresh?: () => void;
  refreshing?: boolean;
  error?: unknown | null;
  stale?: boolean;
}) {
  const href = drillHref(tile);
  return (
    <Card
      role="region"
      aria-label={tile.title}
      className={cn("flex flex-col gap-3 p-5", stale && "opacity-60")}
      data-testid={`tile-${tile.key}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-token bg-accent-soft text-accent-ink"
            aria-hidden
          >
            {icon}
          </div>
          <div>
            <h3 className="text-[13px] font-bold text-foreground">{tile.title}</h3>
            <p className="text-[10.5px] uppercase tracking-wide text-muted-foreground">
              Generated {formatDdMmYyyyHhMm(tile.generatedAt)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <TileStatusBadge status={status ?? tile.status} />
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              disabled={refreshing || stale}
              aria-label={`Refresh ${tile.title}`}
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-token border border-border-strong bg-background text-muted-foreground hover:bg-muted",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                "disabled:cursor-not-allowed disabled:opacity-60",
                refreshing && "animate-pulse",
              )}
              data-testid={`tile-${tile.key}-refresh`}
            >
              <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} aria-hidden />
            </button>
          )}
        </div>
      </div>

      {error ? (
        <TileErrorInline title={tile.title} onRetry={onRefresh} error={error} />
      ) : (
        <div aria-live="polite" data-testid={`tile-${tile.key}-body`}>
          {children}
        </div>
      )}

      <div className="mt-auto flex items-center justify-end pt-2">
        <Link
          href={href}
          className="inline-flex items-center gap-1 text-[12px] font-semibold text-accent-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          data-testid={`tile-${tile.key}-drill`}
          aria-label={`View report for ${tile.title}`}
        >
          View report
          <ArrowRight className="h-3 w-3" aria-hidden />
        </Link>
      </div>
    </Card>
  );
}

function TileErrorInline({
  title,
  onRetry,
  error,
}: {
  title: string;
  onRetry?: () => void;
  error: unknown;
}) {
  const apiErr = asApiError(error);
  const forbidden = apiErr.status === 403;
  return (
    <div
      className="rounded-token border border-destructive-soft bg-destructive-soft/30 p-3"
      data-testid="tile-error-inline"
    >
      <p className="text-[12.5px] font-semibold text-destructive-ink">
        {forbidden ? "You don't have permission to view this tile." : `Couldn't load ${title}.`}
      </p>
      {!forbidden && onRetry && (
        <Button size="sm" onClick={onRetry} className="mt-2" data-testid="tile-error-retry">
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

function formatDdMmYyyyHhMm(iso: string): string {
  try {
    const d = new Date(iso);
    const dd = String(d.getUTCDate()).padStart(2, "0");
    const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
    const yyyy = d.getUTCFullYear();
    const hh = String(d.getUTCHours()).padStart(2, "0");
    const min = String(d.getUTCMinutes()).padStart(2, "0");
    return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
  } catch {
    return iso;
  }
}
