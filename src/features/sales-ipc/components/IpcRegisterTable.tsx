"use client";

import { useState } from "react";
import Link from "next/link";
import { WifiOff, FileText, ChevronDown, ChevronUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/format";
import { RegisterTotalsRow } from "./RegisterTotalsRow";
import { type IpcRegister, type IpcRegisterRow } from "../types";

/**
 * Register table (spec §5 register table; design's stacked artboards). Sticky column header
 * + one row per posted IPC with per-IPC figures AND running cumulative columns AND the
 * pinned totals row (spec §5, §10 "Totals" aria). The identifier cell is the lime
 * `accent-ink` link into the IPC viewer (or editor for a DRAFT — Accounts/Admin only; PM
 * always lands on the read-only viewer). Money right-aligned, tabular; cumulative columns
 * distinct from the "Retention held" panel figure by explicit "(gross)" label (Open item 2).
 * Full state matrix: default · loading skeletons · empty (two variants) · partial "Receipts
 * pending sync" · error+retry · offline banner (all per spec §6).
 */

/** 12 columns: identity + 6 per-IPC + 5 cumulative. Cumulative group has a left border. */
const GRID =
  "minmax(160px,1.4fr) 90px 100px 90px 96px 96px 96px 90px 90px 96px 96px 90px";
const MONEY = "whitespace-nowrap font-mono text-[12px] tabular-nums";
const NUM_HEADERS: Array<{ label: string; cumulative?: boolean }> = [
  { label: "Certified" },
  { label: "Currently-due" },
  { label: "Retention (this IPC)" },
  { label: "Advance recovered" },
  { label: "Received" },
  { label: "Outstanding" },
  { label: "Cum. certified", cumulative: true },
  { label: "Cum. billed-due" },
  { label: "Cum. retained (gross)" },
  { label: "Cum. advance recovered" },
  { label: "Cum. received" },
];

function money(v: string): string {
  return formatMoney(v, { withSymbol: false, fractionDigits: 2 });
}

export function IpcRegisterTable({
  register,
  status,
  offline,
  onRowRoute,
  isDimmed,
  onRetry,
  canCreate,
  onNewIpc,
}: {
  register: IpcRegister | undefined;
  status: "loading" | "error" | "empty" | "loaded";
  offline?: boolean;
  onRowRoute: (row: IpcRegisterRow) => string;
  isDimmed?: boolean;
  onRetry?: () => void;
  canCreate?: boolean;
  onNewIpc?: () => void;
}) {
  return (
    <Card
      data-testid="reg-table-card"
      className={cn("mt-1 flex flex-col overflow-hidden", isDimmed && "opacity-60")}
    >
      <div className="flex items-center gap-2.5 border-b border-border px-4 py-3">
        <span className="text-[13.5px] font-bold text-foreground">IPC register</span>
        <span className="text-[11.5px] text-faint">
          running cumulative totals per posted IPC · figures are server-computed queries
        </span>
      </div>

      {offline && (
        <div className="px-4 pt-3">
          <Alert tone="warning" title="You're offline. Showing the last loaded register.">
            <span className="inline-flex items-center gap-1.5 text-[12.5px]">
              <WifiOff className="h-3.5 w-3.5" aria-hidden />
              Reconnect to refresh figures.
            </span>
          </Alert>
        </div>
      )}

      {status === "loading" ? (
        <div className="flex flex-col gap-2 p-4" data-testid="reg-loading">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
          <Skeleton className="mt-2 h-10 w-full" />
        </div>
      ) : status === "error" ? (
        <div className="p-4" data-testid="reg-error">
          <Alert tone="destructive" title="Couldn't load the project IPC register.">
            <div className="flex flex-col items-start gap-2">
              <span>Check your connection and try again.</span>
              {onRetry && (
                <Button size="sm" onClick={onRetry} data-testid="reg-retry">
                  Retry
                </Button>
              )}
            </div>
          </Alert>
        </div>
      ) : status === "empty" ? (
        <div className="p-8" data-testid="reg-empty">
          <EmptyState
            icon={FileText}
            title="No IPCs yet for this project."
            description={
              canCreate ? "Raise the first Interim Payment Certificate to start the register." : undefined
            }
            action={
              canCreate ? (
                <Button size="md" onClick={onNewIpc} data-testid="reg-empty-new">
                  New IPC
                </Button>
              ) : undefined
            }
          />
        </div>
      ) : register ? (
        <RegisterGrid register={register} onRowRoute={onRowRoute} />
      ) : null}
    </Card>
  );
}

function RegisterGrid({
  register,
  onRowRoute,
}: {
  register: IpcRegister;
  onRowRoute: (row: IpcRegisterRow) => string;
}) {
  return (
    <>
      {/* Desktop (≥1024): full 12-column grid with the cumulative group. */}
      <div className="hidden overflow-x-auto lg:block" data-testid="reg-grid">
        <div style={{ minWidth: 1240 }}>
          {/* group super-header */}
          <div
            role="row"
            aria-hidden
            className="grid border-b border-border-strong bg-surface-2"
            style={{ gridTemplateColumns: GRID }}
          >
            <div />
            <div className="col-span-6 px-2 py-1.5 text-right text-[9.5px] font-bold uppercase tracking-[0.5px] text-faint">
              Per this IPC
            </div>
            <div className="col-span-5 border-l border-border-strong px-2 py-1.5 text-right text-[9.5px] font-bold uppercase tracking-[0.5px] text-accent-ink">
              Cumulative · running through row
            </div>
          </div>

          {/* column header */}
          <div
            role="row"
            className="sticky top-0 z-[1] grid items-center border-b border-border-strong bg-surface-2 text-[10px] font-bold uppercase tracking-[0.2px] text-muted-foreground"
            style={{ gridTemplateColumns: GRID }}
          >
            <div className="px-3 py-2.5">IPC # · date · no.</div>
            {NUM_HEADERS.map((h, i) => (
              <div
                key={h.label}
                className={cn(
                  "px-2 py-2.5 text-right",
                  i === 6 && "border-l border-border-strong",
                )}
              >
                {h.label}
              </div>
            ))}
          </div>

          {register.rows.map((r) => (
            <RegisterRow key={r.ipcId} row={r} href={onRowRoute(r)} />
          ))}

          <RegisterTotalsRow totals={register.totals} gridTemplate={GRID} />
        </div>
      </div>

      {/* Tablet (768–1023): primary columns + a per-row expander for the cumulative figures. */}
      <div className="hidden md:block lg:hidden" data-testid="reg-grid-tablet">
        <RegisterTabletTable register={register} onRowRoute={onRowRoute} />
      </div>

      {/* Mobile (<768): per-IPC cards; release is deferred to desktop (design mobile frame). */}
      <div className="md:hidden" data-testid="reg-grid-mobile">
        <RegisterMobileCards register={register} onRowRoute={onRowRoute} />
      </div>
    </>
  );
}

/** Tablet register: IPC · Certified · Due · Received · Outstanding + a chevron that expands
 *  the cumulative + this-IPC extra figures inline (design tablet frame). Totals pinned. */
const TABLET_GRID = "minmax(140px,1.4fr) 1fr 1fr 1fr 1fr 44px";
function RegisterTabletTable({
  register,
  onRowRoute,
}: {
  register: IpcRegister;
  onRowRoute: (row: IpcRegisterRow) => string;
}) {
  return (
    <div>
      <div
        role="row"
        className="grid items-center border-b border-border-strong bg-surface-2 text-[10px] font-bold uppercase tracking-[0.2px] text-muted-foreground"
        style={{ gridTemplateColumns: TABLET_GRID }}
      >
        <div className="px-3 py-2.5">IPC # · date · no.</div>
        <div className="px-2 py-2.5 text-right">Certified</div>
        <div className="px-2 py-2.5 text-right">Due</div>
        <div className="px-2 py-2.5 text-right">Received</div>
        <div className="px-2 py-2.5 text-right">Outstanding</div>
        <div className="px-2 py-2.5 text-right">Cum.</div>
      </div>
      {register.rows.map((r) => (
        <RegisterTabletRow key={r.ipcId} row={r} href={onRowRoute(r)} />
      ))}
      {/* Totals — pinned, primary columns only. */}
      <div
        role="row"
        aria-label="Totals"
        data-testid="reg-totals-tablet"
        className="grid items-center border-t-2 border-border-strong bg-surface-2"
        style={{ gridTemplateColumns: TABLET_GRID }}
      >
        <div className="px-3 py-2.5">
          <div className="text-[12px] font-bold text-foreground">Totals</div>
          <div className="text-[10px] text-faint">project lifetime</div>
        </div>
        <div className={cn("px-2 py-2.5 text-right", MONEY, "text-muted-foreground")}>{money(register.totals.certified)}</div>
        <div className={cn("px-2 py-2.5 text-right font-semibold text-foreground", MONEY)}>{money(register.totals.billedDue)}</div>
        <div className={cn("px-2 py-2.5 text-right", MONEY, "text-muted-foreground")}>{money(register.totals.received)}</div>
        <div className={cn("px-2 py-2.5 text-right font-semibold", MONEY, Number(register.totals.outstanding) === 0 ? "text-success-ink" : "text-foreground")}>
          {money(register.totals.outstanding)}
        </div>
        <div className="px-2 py-2.5 text-right text-faint" aria-hidden>—</div>
      </div>
    </div>
  );
}

function RegisterTabletRow({ row, href }: { row: IpcRegisterRow; href: string }) {
  const [open, setOpen] = useState(false);
  const settled = Number(row.outstandingAmount) === 0;
  return (
    <div className="border-b border-border">
      <div className="grid items-center" style={{ gridTemplateColumns: TABLET_GRID }}>
        <Link href={href} className="min-w-0 px-3 py-2.5 no-underline hover:underline" data-testid={`reg-trow-${row.ipcId}`}>
          <div className="flex items-center gap-1.5">
            <span className="text-[13px] font-bold tabular-nums text-foreground">#{row.ipcSeqNo}</span>
            <span className="text-[10.5px] tabular-nums text-faint">{formatDate(row.ipcDate)}</span>
          </div>
          <span className="text-[10.5px] font-semibold tabular-nums text-accent-ink">{row.entryNo}</span>
        </Link>
        <div className={cn("px-2 py-2.5 text-right", MONEY, "text-muted-foreground")}>{money(row.certifiedAmount)}</div>
        <div className={cn("px-2 py-2.5 text-right font-semibold text-foreground", MONEY)}>{money(row.currentlyDueAmount)}</div>
        <div className="px-2 py-2.5 text-right">
          {row.receivedAmount === null ? (
            <span className="text-[11px] font-semibold text-warning-ink">Pending</span>
          ) : (
            <span className={cn(MONEY, "text-muted-foreground")}>{money(row.receivedAmount)}</span>
          )}
        </div>
        <div className={cn("px-2 py-2.5 text-right font-semibold", MONEY, settled ? "text-success-ink" : "text-foreground")}>
          {money(row.outstandingAmount)}
        </div>
        <div className="flex justify-center px-1 py-2.5">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label={`${open ? "Collapse" : "Expand"} cumulative figures for IPC #${row.ipcSeqNo}`}
            className="grid h-7 w-7 place-items-center rounded-token border border-border text-muted-foreground hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            data-testid={`reg-trow-toggle-${row.ipcId}`}
          >
            {open ? <ChevronUp className="h-4 w-4" aria-hidden /> : <ChevronDown className="h-4 w-4" aria-hidden />}
          </button>
        </div>
      </div>
      {open && (
        <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 bg-surface-2 px-3 py-3 text-[12px]" data-testid={`reg-trow-detail-${row.ipcId}`}>
          <TabletDetail label="Cum. certified" value={row.cumCertified} />
          <TabletDetail label="Cum. billed-due" value={row.cumBilledDue} />
          <TabletDetail label="Cum. retained (gross)" value={row.cumRetainedHeld} />
          <TabletDetail label="Cum. advance recovered" value={row.cumAdvanceRecovered} />
          <TabletDetail label="Retention (this IPC)" value={row.retentionAmount} />
          <TabletDetail label="Advance recovered" value={row.advanceRecoveredAmount} />
        </div>
      )}
    </div>
  );
}

function TabletDetail({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn(MONEY, "font-semibold text-foreground")}>{value === null ? "—" : money(value)}</span>
    </div>
  );
}

/** Mobile register: project-totals summary + one card per IPC (design mobile frame). Release
 *  is deferred to desktop (the retention panel shows the deferral notice separately). */
function RegisterMobileCards({
  register,
  onRowRoute,
}: {
  register: IpcRegister;
  onRowRoute: (row: IpcRegisterRow) => string;
}) {
  return (
    <div className="flex flex-col gap-3 p-3">
      {/* Project totals · lifetime (navy) */}
      <div className="rounded-card bg-primary px-4 py-3.5 text-primary-foreground" data-testid="reg-mobile-totals">
        <div className="text-[10px] font-bold uppercase tracking-[0.5px] text-primary-foreground/70">
          Project totals · lifetime
        </div>
        <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2.5">
          <MobileTotal label="Certified" value={register.totals.certified} />
          <MobileTotal label="Billed-due" value={register.totals.billedDue} />
          <MobileTotal label="Received" value={register.totals.received} />
          <MobileTotal label="Outstanding" value={register.totals.outstanding} accent />
        </div>
      </div>

      {register.rows.map((r) => {
        const settled = Number(r.outstandingAmount) === 0;
        return (
          <Link
            key={r.ipcId}
            href={onRowRoute(r)}
            className="rounded-card border border-border bg-surface p-3.5 no-underline"
            data-testid={`reg-mcard-${r.ipcId}`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="min-w-0 truncate">
                <span className="text-[14px] font-bold tabular-nums text-foreground">IPC #{r.ipcSeqNo}</span>
                <span className="ml-2 font-mono text-[11.5px] tabular-nums text-accent-ink">{r.entryNo}</span>
              </span>
              <span className="shrink-0 text-[11px] tabular-nums text-faint">{formatDate(r.ipcDate)}</span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2">
              <MobileCardFig label="Certified" value={money(r.certifiedAmount)} />
              <MobileCardFig label="Currently-due" value={money(r.currentlyDueAmount)} />
              <MobileCardFig
                label="Outstanding"
                value={r.receivedAmount === null ? "Pending" : money(r.outstandingAmount)}
                tone={r.receivedAmount === null ? "warning" : settled ? "success" : undefined}
              />
            </div>
          </Link>
        );
      })}
    </div>
  );
}

function MobileTotal({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <div className="text-[10.5px] text-primary-foreground/60">{label}</div>
      <div className={cn("font-mono text-[15px] font-bold tabular-nums", accent ? "text-accent" : "text-primary-foreground")}>
        ৳ {money(value)}
      </div>
    </div>
  );
}

function MobileCardFig({ label, value, tone }: { label: string; value: string; tone?: "warning" | "success" }) {
  return (
    <div>
      <div className="text-[9.5px] font-semibold uppercase tracking-[0.3px] text-faint">{label}</div>
      <div
        className={cn(
          "font-mono text-[13px] font-semibold tabular-nums",
          tone === "warning" ? "text-warning-ink" : tone === "success" ? "text-success-ink" : "text-foreground",
        )}
      >
        {tone === "warning" ? value : `৳ ${value}`}
      </div>
    </div>
  );
}

function RegisterRow({ row, href }: { row: IpcRegisterRow; href: string }) {
  return (
    <Link
      href={href}
      role="row"
      data-testid={`reg-row-${row.ipcId}`}
      className="grid items-stretch border-b border-border no-underline hover:bg-surface-2"
      style={{ gridTemplateColumns: GRID }}
    >
      <div className="min-w-0 px-3 py-2.5">
        <div className="flex items-center gap-1.5">
          <span className="text-[13px] font-bold tabular-nums text-foreground">#{row.ipcSeqNo}</span>
          <span className="text-[10.5px] tabular-nums text-faint">{formatDate(row.ipcDate)}</span>
        </div>
        <span
          className="text-[10.5px] font-semibold tabular-nums text-accent-ink hover:underline"
          data-testid="reg-row-entryno"
        >
          {row.entryNo}
        </span>
      </div>
      <MoneyCell value={row.certifiedAmount} muted />
      <MoneyCell value={row.currentlyDueAmount} strong />
      <MoneyCell value={row.retentionAmount} muted />
      <MoneyCell value={row.advanceRecoveredAmount} muted />
      <ReceivedCell value={row.receivedAmount} />
      <MoneyCell value={row.outstandingAmount} strong outstanding />
      <MoneyCell value={row.cumCertified} muted leftBorder />
      <MoneyCell value={row.cumBilledDue} muted />
      <MoneyCell value={row.cumRetainedHeld} muted />
      <MoneyCell value={row.cumAdvanceRecovered} muted />
      <ReceivedCell value={row.cumReceived} cumulative />
    </Link>
  );
}

function MoneyCell({
  value,
  muted,
  strong,
  leftBorder,
  outstanding,
}: {
  value: string;
  muted?: boolean;
  strong?: boolean;
  leftBorder?: boolean;
  outstanding?: boolean;
}) {
  const settled = outstanding && Number(value) === 0;
  return (
    <div
      className={cn(
        "px-2 py-2.5 text-right",
        leftBorder && "border-l border-border",
      )}
    >
      <span
        className={cn(
          MONEY,
          strong ? "font-semibold" : "",
          muted ? "text-muted-foreground" : "text-foreground",
          // Design: a zero outstanding reads as "settled" in success-ink; a positive
          // balance is plain bold foreground (not a warning tone).
          settled && "text-success-ink",
        )}
      >
        {money(value)}
      </span>
    </div>
  );
}

function ReceivedCell({ value, cumulative }: { value: string | null; cumulative?: boolean }) {
  if (value === null) {
    return (
      <div className="px-2 py-2.5 text-right">
        {cumulative ? (
          <span className="text-[11px] text-faint" data-testid="reg-received-pending-cum">—</span>
        ) : (
          <span
            title="Receipts pending sync"
            className="inline-flex h-[18px] items-center gap-1 rounded-pill bg-warning-soft px-2 text-[9.5px] font-semibold text-warning-ink"
            data-testid="reg-received-pending"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-warning" aria-hidden />
            Pending sync
          </span>
        )}
      </div>
    );
  }
  return (
    <div className="px-2 py-2.5 text-right">
      <span className={cn(MONEY, "text-muted-foreground")}>{money(value)}</span>
    </div>
  );
}
