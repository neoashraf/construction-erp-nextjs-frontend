"use client";

import Link from "next/link";
import { RefreshCw } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { type Tile, routeForReport } from "../types";
import { compactVM } from "../compact-vm";
import { tileMeta } from "../tile-meta";
import { TileStatusBadge } from "./TileStatusBadge";

/**
 * FE-61 compact tile — the design's tablet/mobile tile rendering (`compactVM`):
 * a single headline + one summary line. `variant="tablet"` keeps a header-refresh
 * and an inline "As of …" caption; `variant="mobile"` adds the bottom action row
 * (full-width "View report" + a labelled "Refresh", ≥44px touch targets).
 */
export function CompactTile({
  tile,
  variant,
  onRefresh,
  refreshing = false,
  stale = false,
}: {
  tile: Tile;
  variant: "tablet" | "mobile";
  onRefresh?: () => void;
  refreshing?: boolean;
  stale?: boolean;
}) {
  const meta = tileMeta(tile.key);
  const vm = compactVM(tile);
  const href = drillHref(tile);
  const mobile = variant === "mobile";

  return (
    <Card
      role="region"
      aria-label={tile.title}
      className={cn(
        "flex flex-col rounded-lg border-border p-3.5",
        !mobile && "min-h-[150px]",
        stale && "opacity-60",
        tile.key === "top-receivables-payables" && "sm:col-span-2",
      )}
      data-testid={`tile-${tile.key}-compact`}
    >
      {/* header */}
      <div className="flex items-center gap-2.5">
        <span
          className={cn(
            "flex flex-none items-center justify-center rounded-md font-bold",
            mobile ? "h-[26px] w-[26px] text-[10px]" : "h-6 w-6 text-[9.5px]",
            meta.chip,
          )}
          aria-hidden
        >
          {meta.glyph}
        </span>
        <Link
          href={href}
          className={cn(
            "min-w-0 flex-1 truncate font-semibold text-foreground hover:text-accent-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
            mobile ? "text-[13.5px]" : "text-[12.5px]",
          )}
        >
          {tile.title}
        </Link>
        <TileStatusBadge status={tile.status} testId={false} />
        {!mobile && onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing || stale}
            aria-label={`Refresh ${tile.title}`}
            className="flex h-[26px] w-[26px] flex-none items-center justify-center rounded-md border border-border-strong bg-background text-muted-foreground hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-60"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} aria-hidden />
          </button>
        )}
      </div>

      {/* headline + subline */}
      <div className="mt-3">
        <span
          className={cn(
            "font-mono font-bold leading-[1.05] tabular-nums",
            mobile ? "text-[26px]" : "text-[22px]",
            vm.headClass,
          )}
        >
          {vm.headline}
        </span>
        <p className={cn("mt-1.5 leading-[1.45] text-muted-foreground", mobile ? "text-[12.5px]" : "text-[12px]")}>
          {vm.subline}
        </p>
      </div>

      {mobile ? (
        <>
          <div className="mt-3 flex items-center gap-2.5 border-t border-muted pt-3">
            <Link
              href={href}
              className="flex h-[42px] flex-1 items-center justify-center rounded-token bg-muted text-[13px] font-semibold text-foreground hover:bg-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              View report
            </Link>
            {onRefresh && (
              <button
                type="button"
                onClick={onRefresh}
                disabled={refreshing || stale}
                className="flex h-[42px] items-center gap-1.5 rounded-token border border-border-strong bg-background px-[15px] text-[13px] font-semibold text-foreground hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-60"
              >
                <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} aria-hidden />
                Refresh
              </button>
            )}
          </div>
          <span className="mt-2.5 text-[10px] text-faint">As of {formatAsOf(tile.generatedAt)}</span>
        </>
      ) : (
        <>
          <div className="flex-1" />
          <div className="mt-2 flex items-center justify-between gap-2.5">
            <span className="text-[10px] text-faint">As of {formatAsOf(tile.generatedAt)}</span>
            <Link
              href={href}
              className="text-[11px] font-semibold text-muted-foreground hover:text-accent-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              View report →
            </Link>
          </div>
        </>
      )}
    </Card>
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
