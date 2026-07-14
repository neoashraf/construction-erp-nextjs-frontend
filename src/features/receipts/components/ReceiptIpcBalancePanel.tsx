"use client";

import Link from "next/link";
import { ArrowDown, ExternalLink, RefreshCw } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatMoney } from "@/lib/money";

/**
 * IPC & balance-due-after panel (spec §5; FR-REC-015/-016/-018; brief §5.6). IPC-linked
 * receipts only. Renders the picked IPC + a **snapshot** of "currently due → after this
 * receipt" (Refresh re-fetches — this is *not* live-recomputed, unlike the editor). Also
 * cross-links to the Receipt list pre-filtered by `ipcId` so users can jump to every
 * receipt applied to the same IPC (FR-REC-016).
 */
export function ReceiptIpcBalancePanel({
  ipcId,
  ipcLabel,
  ipcCurrentlyDue,
  ipcOutstandingAfter,
  onRefresh,
  isRefreshing,
}: {
  ipcId: string;
  ipcLabel: string;
  ipcCurrentlyDue: string | null;
  ipcOutstandingAfter: string | null;
  onRefresh: () => void;
  isRefreshing: boolean;
}) {
  return (
    <Card className="p-4" data-testid="receipt-ipc-balance-panel">
      <div className="mb-3 flex items-center gap-2">
        <h2 className="text-[13px] font-bold text-foreground">Referenced IPC</h2>
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto gap-1"
          onClick={onRefresh}
          disabled={isRefreshing}
          data-testid="receipt-ipc-balance-refresh"
          aria-label="Refresh the IPC balance"
        >
          <RefreshCw className={isRefreshing ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} aria-hidden />
          Refresh
        </Button>
      </div>

      <Link
        href={`/sales/ipcs/${ipcId}`}
        className="inline-flex items-center gap-1 font-mono text-[13.5px] font-semibold text-accent-ink hover:underline"
        data-testid="receipt-view-ipc"
      >
        <ExternalLink className="h-3.5 w-3.5" aria-hidden />
        {ipcLabel}
      </Link>

      <div className="mt-4 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[12.5px] text-muted-foreground">IPC currently due</span>
          <span className="font-mono text-[13.5px] font-semibold tabular-nums text-foreground">
            {ipcCurrentlyDue != null ? formatMoney(ipcCurrentlyDue) : <Skeleton className="inline-block h-4 w-16" />}
          </span>
        </div>
        <div className="my-2 flex items-center gap-2">
          <span className="flex-1 h-px bg-border" />
          <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
            <ArrowDown className="h-3 w-3" aria-hidden />
            after this receipt
          </span>
          <span className="flex-1 h-px bg-border" />
        </div>
        <div className="flex items-center justify-between rounded-token bg-accent-soft px-3 py-2">
          <span className="text-[12.5px] font-semibold text-accent-ink">Balance due</span>
          <span
            className="font-mono text-[15px] font-bold tabular-nums text-accent-ink"
            data-testid="receipt-balance-due-after"
          >
            {ipcOutstandingAfter != null ? formatMoney(ipcOutstandingAfter) : "—"}
          </span>
        </div>
      </div>

      <Link
        href={`/receipts?ipcId=${ipcId}`}
        className="mt-3 inline-flex items-center gap-1 text-[12px] font-semibold text-accent-ink hover:underline"
        data-testid="receipt-view-all-applied"
      >
        View all receipts applied to this IPC
      </Link>
    </Card>
  );
}
