"use client";

import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/money";
import { EmptyState } from "@/components/ui/empty-state";
import { RetentionBreakdownRow, type RetentionBreakdownItem } from "./RetentionBreakdownRow";
import { type IpcRegister } from "../types";

/**
 * Retention panel (spec §5 retention; FR-SAL-018/-019). Headline "Total retention held"
 * (net of releases) + "Total retention released" (Σ posted release amounts) + per-IPC
 * breakdown rows for every IPC with `retentionAmount > 0`. Held is DISTINCT from the
 * register's cumulative "retained (gross)" column (Open item 2 — labelled distinctly). The
 * headline totals derive from the same register response (`totals.retainedHeld` is held net;
 * `Σ (retentionAmount − retentionHeldAmount)` per row is released) — no separate query.
 * Full state matrix: default · loading · empty · error+retry · permission-denied (PM: no
 * Release buttons rendered) — all per spec §6.
 */
function money(v: string): string {
  return formatMoney(v, { withSymbol: false, fractionDigits: 2 });
}

export function RetentionPanel({
  register,
  status,
  canRelease,
  releasingIpcId,
  onRetry,
  onOpenRelease,
  isDimmed,
}: {
  register: IpcRegister | undefined;
  status: "loading" | "error" | "empty" | "loaded";
  canRelease: boolean;
  releasingIpcId: string | null;
  onRetry?: () => void;
  onOpenRelease: (item: RetentionBreakdownItem) => void;
  isDimmed?: boolean;
}) {
  const items = useMemo<RetentionBreakdownItem[]>(() => {
    if (!register) return [];
    // `retentionAmount` and `retentionHeldAmount` both come off the register row; we compute
    // `retentionHeldAmount` as `retentionAmount` (register uses `cumRetainedHeld` for cumulative
    // gross — per row, `retentionAmount` IS the gross held minus any release we track separately).
    // The register endpoint doesn't expose per-IPC "held net" directly (design §5), so we treat
    // `retentionAmount` as the current per-IPC net held for Phase 1 (spec Open item 2). Any
    // released amounts show under the row's expandable audit list; the panel headline uses the
    // authoritative `totals.retainedHeld` (net of releases across the project).
    return register.rows
      .filter((r) => Number(r.retentionAmount) > 0)
      .map<RetentionBreakdownItem>((r) => ({
        ipcId: r.ipcId,
        ipcSeqNo: r.ipcSeqNo,
        entryNo: r.entryNo,
        retentionAmount: r.retentionAmount,
        retentionHeldAmount: r.retentionAmount, // per-IPC held net; see comment above
      }));
  }, [register]);

  const totalHeld = register?.totals.retainedHeld ?? "0.0000";
  const totalReleased = useMemo(() => {
    if (!register) return "0.0000";
    // cumRetainedHeld is the running sum of gross withheld through the last row → project-total gross.
    // Released = gross − net-held (totals.retainedHeld). Guard against negative from rounding.
    const gross = register.rows.length > 0
      ? Number(register.rows[register.rows.length - 1]!.cumRetainedHeld)
      : 0;
    const held = Number(totalHeld);
    return Math.max(gross - held, 0).toFixed(4);
  }, [register, totalHeld]);

  return (
    <Card data-testid="retention-panel" className={isDimmed ? "opacity-60" : undefined}>
      <div className="border-b border-border px-4 py-3">
        <div className="flex items-center gap-2.5">
          <span className="text-[13.5px] font-bold text-foreground">Retention</span>
          <span className="text-[11.5px] text-faint">held net of releases · release action posts a controlled ledger movement</span>
        </div>
      </div>

      {status === "loading" ? (
        <div className="flex flex-col gap-3 p-4" data-testid="retention-loading">
          <div className="grid grid-cols-2 gap-3">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-11 w-full" />
        </div>
      ) : status === "error" ? (
        <div className="p-4" data-testid="retention-error">
          <Alert tone="destructive" title="Couldn't load retention data.">
            <div className="flex flex-col items-start gap-2">
              <span>Check your connection and try again.</span>
              {onRetry && (
                <Button size="sm" onClick={onRetry} data-testid="retention-retry">
                  Retry
                </Button>
              )}
            </div>
          </Alert>
        </div>
      ) : items.length === 0 ? (
        <div className="p-6" data-testid="retention-empty">
          <EmptyState title="No retention held on this project." />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 border-b border-border p-4 md:grid-cols-2">
            <Headline label="Retention held" value={totalHeld} tone="warning" testId="retention-total-held" />
            <Headline label="Retention released" value={totalReleased} tone="success" testId="retention-total-released" />
          </div>
          <div data-testid="retention-breakdown">
            {items.map((it) => (
              <RetentionBreakdownRow
                key={it.ipcId}
                item={it}
                canRelease={canRelease}
                releasing={releasingIpcId === it.ipcId}
                onOpenRelease={onOpenRelease}
              />
            ))}
          </div>
        </>
      )}
    </Card>
  );
}

function Headline({
  label,
  value,
  tone,
  testId,
}: {
  label: string;
  value: string;
  tone: "warning" | "success";
  testId: string;
}) {
  const bg = tone === "warning" ? "bg-warning-soft" : "bg-success-soft";
  const ink = tone === "warning" ? "text-warning-ink" : "text-success-ink";
  return (
    <div className={`rounded-token px-4 py-3 ${bg}`} data-testid={testId}>
      <div className={`text-[10.5px] font-semibold uppercase tracking-[0.4px] ${ink}`}>{label}</div>
      <div className={`mt-0.5 font-mono text-[19px] font-bold tabular-nums ${ink}`}>৳ {money(value)}</div>
    </div>
  );
}
