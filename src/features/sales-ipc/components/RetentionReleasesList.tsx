"use client";

import { RefreshCw } from "lucide-react";
import { formatMoney } from "@/lib/money";
import { formatDate, formatDateTime } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import { useRetentionReleases } from "../hooks/useRetentionReleases";

/**
 * Per-IPC retention-releases audit expander (spec §5 "Retention releases list"; FR-SAL-018).
 * A single-IPC fetch failure surfaces as an inline "Couldn't load" + retry icon (spec §6
 * "partial state") — the panel keeps loading the other rows. Rendered inline under the
 * corresponding IPC breakdown row when expanded.
 */
function money(v: string): string {
  return formatMoney(v, { withSymbol: false, fractionDigits: 2 });
}

export function RetentionReleasesList({ ipcId, enabled }: { ipcId: string; enabled: boolean }) {
  const query = useRetentionReleases(ipcId, enabled);
  if (!enabled) return null;

  if (query.isLoading) {
    return (
      <div className="flex flex-col gap-1.5 px-3 py-2" data-testid={`releases-loading-${ipcId}`}>
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    );
  }

  if (query.isError) {
    return (
      <div
        className="flex items-center gap-2 px-3 py-2 text-[11.5px] text-muted-foreground"
        data-testid={`releases-error-${ipcId}`}
      >
        <span className="text-faint">—</span>
        <span>Couldn&apos;t load releases.</span>
        <button
          type="button"
          onClick={() => query.refetch()}
          className="inline-flex items-center gap-1 text-accent-ink hover:underline"
          data-testid={`releases-retry-${ipcId}`}
          aria-label="Retry loading retention releases"
        >
          <RefreshCw className="h-3 w-3" aria-hidden /> Retry
        </button>
      </div>
    );
  }

  const rows = query.data ?? [];
  if (rows.length === 0) {
    return (
      <div className="px-3 py-2 text-[11.5px] text-faint" data-testid={`releases-empty-${ipcId}`}>
        No releases have been posted against this IPC yet.
      </div>
    );
  }

  return (
    <div className="border-t border-border" data-testid={`releases-list-${ipcId}`}>
      <div className="grid grid-cols-[minmax(110px,1fr)_minmax(120px,1fr)_minmax(140px,1.4fr)_minmax(140px,1.4fr)] gap-2 border-b border-border bg-surface-2 px-3 py-1.5 text-[9.5px] font-bold uppercase tracking-[0.3px] text-muted-foreground">
        <span>Release date</span>
        <span className="text-right">Amount ৳</span>
        <span>Number</span>
        <span>Posted</span>
      </div>
      {rows.map((r) => (
        <div
          key={r.id}
          className="grid grid-cols-[minmax(110px,1fr)_minmax(120px,1fr)_minmax(140px,1.4fr)_minmax(140px,1.4fr)] gap-2 border-b border-border px-3 py-1.5 text-[11.5px] last:border-b-0"
          data-testid={`release-${r.id}`}
        >
          <span className="tabular-nums text-foreground">{formatDate(r.releaseDate)}</span>
          <span className="text-right font-mono tabular-nums font-semibold text-foreground">{money(r.releasedAmount)}</span>
          <span className="font-mono tabular-nums text-accent-ink">{r.entryNo}</span>
          <span className="tabular-nums text-muted-foreground">{formatDateTime(r.postedAt)}</span>
        </div>
      ))}
    </div>
  );
}
