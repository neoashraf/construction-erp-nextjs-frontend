"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { RetentionReleasesList } from "./RetentionReleasesList";

/**
 * One row of the retention panel's PER-IPC BREAKDOWN table (spec §5 "Retention panel · Per-IPC
 * breakdown row"; FR-SAL-018/-019). Columns mirror the design: IPC # · retention (gross) ·
 * held (net) · releases-count (toggles the audit sub-list) · a Release button gated on
 * `retentionHeldAmount > 0` (else disabled with the spec §13 tooltip "No retention held.").
 * "Release retention" is HIDDEN (not disabled) for actors lacking `sales:release-retention`
 * (PM, spec §11) — hiding is UX, the server re-checks regardless. `Releasing…` state is shown
 * inline while the mutation is in flight for this specific IPC. The releases-count chevron
 * expands to the audit list of releases already posted (reuses the panel's parallel fetch
 * cache — no refetch on expand).
 */
function money(v: string): string {
  return formatMoney(v, { withSymbol: false, fractionDigits: 2 });
}

const GRID = "minmax(110px,1.2fr) minmax(88px,1fr) minmax(88px,1fr) 64px auto";

export interface RetentionBreakdownItem {
  ipcId: string;
  ipcSeqNo: number;
  entryNo: string;
  retentionAmount: string; // gross withheld
  retentionHeldAmount: string; // net of releases
  releaseCount: number;
  releasesLoading: boolean;
  releasesError: boolean;
}

export function RetentionBreakdownRow({
  item,
  canRelease,
  releasing,
  onOpenRelease,
}: {
  item: RetentionBreakdownItem;
  canRelease: boolean;
  releasing: boolean;
  onOpenRelease: (item: RetentionBreakdownItem) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const held = Number(item.retentionHeldAmount);
  const disabled = held <= 0;
  const hasReleases = item.releaseCount > 0;
  // The releases count is derived from a per-IPC fetch; while it loads show "…", and if it
  // fails let the row still expand so the inline error+retry (spec §6 partial) is reachable.
  const canExpand = hasReleases || item.releasesError;

  return (
    <div className="border-b border-border last:border-b-0" data-testid={`ret-row-${item.ipcId}`}>
      <div
        className="grid items-center gap-3 px-3 py-2.5"
        style={{ gridTemplateColumns: GRID }}
      >
        {/* IPC # + number */}
        <div className="min-w-0 truncate">
          <span className="font-bold tabular-nums text-foreground">#{item.ipcSeqNo}</span>
          <span className="ml-2 font-mono text-[11.5px] tabular-nums text-accent-ink">{item.entryNo}</span>
        </div>

        {/* Retention (gross) */}
        <div className="text-right font-mono text-[12px] tabular-nums text-muted-foreground">
          {money(item.retentionAmount)}
        </div>

        {/* Held (net) */}
        <div
          className={cn(
            "text-right font-mono text-[12.5px] font-semibold tabular-nums",
            held > 0 ? "text-foreground" : "text-faint",
          )}
        >
          {money(item.retentionHeldAmount)}
        </div>

        {/* Releases count — toggles the audit sub-list */}
        <div className="flex justify-end">
          {item.releasesLoading ? (
            <span className="text-[12px] tabular-nums text-faint" aria-label="Loading releases">
              …
            </span>
          ) : canExpand ? (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className={cn(
                "inline-flex items-center gap-1 rounded-token px-1.5 py-0.5 text-[12px] font-semibold tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                item.releasesError ? "text-warning-ink hover:bg-warning-soft" : "text-accent-ink hover:bg-accent-soft",
              )}
              aria-expanded={expanded}
              aria-label={
                item.releasesError
                  ? `Retry loading releases for IPC #${item.ipcSeqNo}`
                  : `${expanded ? "Collapse" : "Expand"} ${item.releaseCount} release${item.releaseCount === 1 ? "" : "s"} for IPC #${item.ipcSeqNo}`
              }
              data-testid={`ret-row-toggle-${item.ipcId}`}
            >
              {item.releasesError ? <TriangleAlert className="h-3.5 w-3.5" aria-hidden /> : item.releaseCount}
              {expanded ? <ChevronUp className="h-3.5 w-3.5" aria-hidden /> : <ChevronDown className="h-3.5 w-3.5" aria-hidden />}
            </button>
          ) : (
            <span className="text-[12px] tabular-nums text-faint" aria-label="No releases">
              —
            </span>
          )}
        </div>

        {/* Release action */}
        <div className="flex justify-end">
          {canRelease && (
            <Button
              size="sm"
              variant={disabled ? "outline" : "primary"}
              disabled={disabled || releasing}
              aria-busy={releasing || undefined}
              onClick={() => onOpenRelease(item)}
              title={disabled ? "No retention held." : undefined}
              aria-label={`Release retention for IPC #${item.ipcSeqNo}`}
              data-testid={`ret-release-btn-${item.ipcId}`}
            >
              {releasing ? "Releasing…" : "Release retention"}
            </Button>
          )}
        </div>
      </div>
      {expanded && <RetentionReleasesList ipcId={item.ipcId} enabled={expanded} />}
    </div>
  );
}
