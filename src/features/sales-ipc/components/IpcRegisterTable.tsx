"use client";

import Link from "next/link";
import { WifiOff } from "lucide-react";
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
  { label: "Certified ৳" },
  { label: "Currently-due ৳" },
  { label: "Retention ৳" },
  { label: "Adv rec ৳" },
  { label: "Received ৳" },
  { label: "Outstanding ৳" },
  { label: "Cum certified ৳", cumulative: true },
  { label: "Cum billed-due ৳" },
  { label: "Cum retained (gross) ৳" },
  { label: "Cum adv rec ৳" },
  { label: "Cum received ৳" },
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
    <div className="overflow-x-auto" data-testid="reg-grid">
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
          <div className="px-3 py-2.5">IPC # · date · number</div>
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
  const owed = outstanding && Number(value) > 0;
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
          owed && "text-warning-ink",
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
