"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { RetentionReleasesList } from "./RetentionReleasesList";

/**
 * One row of the retention panel's per-IPC breakdown (spec §5 "Retention panel · Per-IPC
 * breakdown row"; FR-SAL-018/-019). Shows IPC # · gross retention · currently-held (net of
 * releases) · a Release button gated on `retentionHeldAmount > 0` (else disabled with the
 * spec §13 tooltip "No retention held.") — and expands to the audit list of releases
 * already posted (spec §5 "Retention releases list"). "Release retention" is HIDDEN (not
 * disabled) for actors lacking `sales:release-retention` (PM, spec §11 "no Release button
 * rendered at all") — hiding is UX, the server re-checks regardless. `Releasing…` state is
 * shown inline while the mutation is in flight for this specific IPC.
 */
function money(v: string): string {
  return formatMoney(v, { withSymbol: false, fractionDigits: 2 });
}

export interface RetentionBreakdownItem {
  ipcId: string;
  ipcSeqNo: number;
  entryNo: string;
  retentionAmount: string; // gross withheld
  retentionHeldAmount: string; // net of releases
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

  return (
    <div className="border-b border-border last:border-b-0" data-testid={`ret-row-${item.ipcId}`}>
      <div className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:gap-4">
        <div className="grid flex-1 grid-cols-[1fr_auto_auto] items-center gap-3 sm:gap-4">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="flex min-w-0 items-center gap-1.5 text-left text-[13px] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-expanded={expanded}
            aria-label={`${expanded ? "Collapse" : "Expand"} releases for IPC #${item.ipcSeqNo}`}
            data-testid={`ret-row-toggle-${item.ipcId}`}
          >
            {expanded ? <ChevronDown className="h-4 w-4 flex-none text-muted-foreground" aria-hidden /> : <ChevronRight className="h-4 w-4 flex-none text-muted-foreground" aria-hidden />}
            <span className="min-w-0 truncate">
              <span className="font-bold tabular-nums text-foreground">#{item.ipcSeqNo}</span>
              <span className="ml-2 font-mono text-[11.5px] tabular-nums text-accent-ink">{item.entryNo}</span>
            </span>
          </button>
          <div className="text-right">
            <div className="text-[9.5px] uppercase tracking-[0.4px] text-faint">Gross</div>
            <div className="font-mono text-[12px] tabular-nums text-muted-foreground">{money(item.retentionAmount)}</div>
          </div>
          <div className="text-right">
            <div className="text-[9.5px] uppercase tracking-[0.4px] text-faint">Held (net)</div>
            <div className={cn("font-mono text-[12.5px] font-semibold tabular-nums", held > 0 ? "text-foreground" : "text-faint")}>
              {money(item.retentionHeldAmount)}
            </div>
          </div>
        </div>
        {canRelease && (
          <div className="flex items-center justify-end">
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
          </div>
        )}
      </div>
      {expanded && <RetentionReleasesList ipcId={item.ipcId} enabled={expanded} />}
    </div>
  );
}
