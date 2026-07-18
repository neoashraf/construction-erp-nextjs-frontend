"use client";

import { useMemo } from "react";
import { Info, Monitor } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/money";
import { EmptyState } from "@/components/ui/empty-state";
import { useRetentionReleasesForIpcs } from "../hooks/useRetentionReleases";
import { RetentionBreakdownRow, type RetentionBreakdownItem } from "./RetentionBreakdownRow";
import { type IpcRegister } from "../types";

/**
 * Retention panel (spec §5 retention; FR-SAL-018/-019). Two-column layout per the design's
 * artboard: LEFT = "Retention held" (navy, net of releases) + "Retention released" (surface)
 * KPI cards + a lime callout reconciling held-net against the register's cumulative gross;
 * RIGHT = the PER-IPC BREAKDOWN table (IPC # · gross · held-net · releases-count · Release).
 * Held-net + the releases count are DERIVED from `GET …/ipc/{id}/retention-releases` (fetched
 * in parallel via `useRetentionReleasesForIpcs`) — neither is on the register-read shape, and
 * we add no contract field. Held (net) is DISTINCT from the register's cumulative "retained
 * (gross)" column (Open item 2 — the callout spells out the relationship).
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
  // Every posted IPC that ever withheld retention appears in the breakdown (design shows a row
  // even once held-net hits 0 — its Release button is then disabled). Fetch releases for all
  // of them in parallel so we can render held-net + the releases count inline.
  const grossRows = useMemo(
    () => (register ? register.rows.filter((r) => Number(r.retentionAmount) > 0) : []),
    [register],
  );
  const ipcIds = useMemo(() => grossRows.map((r) => r.ipcId), [grossRows]);
  const releasesByIpc = useRetentionReleasesForIpcs(ipcIds, status === "loaded");

  const items = useMemo<RetentionBreakdownItem[]>(() => {
    return grossRows.map<RetentionBreakdownItem>((r) => {
      const summary = releasesByIpc[r.ipcId];
      const released = summary?.releasedTotal ?? "0.0000";
      const heldNet = Math.max(Number(r.retentionAmount) - Number(released), 0).toFixed(4);
      return {
        ipcId: r.ipcId,
        ipcSeqNo: r.ipcSeqNo,
        entryNo: r.entryNo,
        retentionAmount: r.retentionAmount, // gross withheld
        retentionHeldAmount: heldNet, // net of releases (gross − Σ released)
        releaseCount: summary?.count ?? 0,
        releasesLoading: summary?.isLoading ?? false,
        releasesError: summary?.isError ?? false,
      };
    });
  }, [grossRows, releasesByIpc]);

  const totalHeld = register?.totals.retainedHeld ?? "0.0000";
  const grossTotal = useMemo(() => {
    if (!register || register.rows.length === 0) return "0.0000";
    // cumRetainedHeld is the running sum of gross withheld through the last row → project gross.
    return Number(register.rows[register.rows.length - 1]!.cumRetainedHeld).toFixed(4);
  }, [register]);
  const totalReleased = useMemo(
    () => Math.max(Number(grossTotal) - Number(totalHeld), 0).toFixed(4),
    [grossTotal, totalHeld],
  );

  return (
    <Card data-testid="retention-panel" className={isDimmed ? "opacity-60" : undefined}>
      <div className="border-b border-border px-4 py-3">
        <div className="flex items-center gap-2.5">
          <span className="text-[13.5px] font-bold text-foreground">Retention</span>
          <span className="text-[11.5px] text-faint">held vs released across this project&apos;s IPCs</span>
        </div>
      </div>

      {status === "loading" ? (
        <div className="grid grid-cols-1 gap-4 p-4 lg:grid-cols-[minmax(0,320px)_1fr]" data-testid="retention-loading">
          <div className="flex flex-col gap-3">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
          <div className="flex flex-col gap-2">
            <Skeleton className="h-11 w-full" />
            <Skeleton className="h-11 w-full" />
            <Skeleton className="h-11 w-full" />
          </div>
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
        {/* Mobile (<768): compact held/released summary; release deferred to desktop. */}
        <div className="p-4 md:hidden" data-testid="retention-mobile">
          <div className="rounded-card border border-border bg-surface px-4 py-3 text-[13px]">
            Held <span className="font-mono font-bold tabular-nums text-foreground">৳ {money(totalHeld)}</span>
            {" · "}released <span className="font-mono font-bold tabular-nums text-foreground">৳ {money(totalReleased)}</span>
          </div>
          <div className="mt-3 flex items-center gap-2 rounded-card bg-warning-soft px-3 py-2.5 text-[12px] text-warning-ink">
            <Monitor className="h-4 w-4 shrink-0" aria-hidden />
            Release retention is available on desktop.
          </div>
        </div>

        {/* Tablet/desktop (≥768): the full two-column panel. At tablet the KPI cards sit
            side-by-side with the breakdown full-width below; at ≥1024 they stack in a 320px
            left rail beside the breakdown (design's desktop vs tablet retention frames). */}
        <div className="hidden grid-cols-1 gap-6 p-4 md:grid lg:grid-cols-[minmax(0,320px)_1fr]">
          {/* LEFT — held / released KPIs + reconciliation callout */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
            <div
              className="rounded-card bg-primary px-4 py-3.5 text-primary-foreground"
              data-testid="retention-total-held"
            >
              <div className="text-[10.5px] font-semibold uppercase tracking-[0.4px] text-primary-foreground/70">
                Retention held
              </div>
              <div className="mt-1 font-mono text-[24px] font-bold tabular-nums">৳ {money(totalHeld)}</div>
              <div className="mt-1 text-[10.5px] text-primary-foreground/60">
                net of releases · Σ retention − Σ released
              </div>
            </div>
            <div
              className="rounded-card border border-border bg-surface px-4 py-3.5"
              data-testid="retention-total-released"
            >
              <div className="text-[10.5px] font-semibold uppercase tracking-[0.4px] text-muted-foreground">
                Retention released
              </div>
              <div className="mt-1 font-mono text-[24px] font-bold tabular-nums text-foreground">
                ৳ {money(totalReleased)}
              </div>
              <div className="mt-1 text-[10.5px] text-faint">Σ released across posted IPCs</div>
            </div>
            <div
              className="col-span-2 flex gap-2 rounded-card bg-accent-soft px-3 py-2.5 text-[11.5px] leading-relaxed text-accent-ink lg:col-span-1"
              data-testid="retention-reconcile"
            >
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              <span>
                Distinct from the register&apos;s <strong>Cumulative retained (gross)</strong> ৳ {money(grossTotal)}.
                Held (net) = gross ৳ {money(grossTotal)} − released ৳ {money(totalReleased)} ={" "}
                <strong>৳ {money(totalHeld)}</strong>.
              </span>
            </div>
          </div>

          {/* RIGHT — per-IPC breakdown table (scrolls horizontally if narrower than its
              min-width so the Release button never clips). */}
          <div className="min-w-0">
            <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.5px] text-faint">
              Per-IPC breakdown
            </div>
            <div className="overflow-x-auto rounded-card border border-border" data-testid="retention-breakdown">
              <div className="min-w-[460px]">
                <div className="grid grid-cols-[minmax(110px,1.2fr)_minmax(88px,1fr)_minmax(88px,1fr)_64px_auto] items-center gap-3 border-b border-border bg-surface-2 px-3 py-2 text-[9.5px] font-bold uppercase tracking-[0.3px] text-muted-foreground">
                  <span>IPC #</span>
                  <span className="text-right">Retention (gross)</span>
                  <span className="text-right">Held (net)</span>
                  <span className="text-right">Releases</span>
                  <span aria-hidden />
                </div>
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
            </div>
          </div>
        </div>
        </>
      )}
    </Card>
  );
}
