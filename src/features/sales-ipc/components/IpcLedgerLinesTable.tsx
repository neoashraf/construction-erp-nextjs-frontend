"use client";

import { useState } from "react";
import { ChevronRight, CheckCircle2, ExternalLink, Lock, AlertCircle } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/money";
import { Alert } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { useMasterLookups, type MasterLookups } from "@/lib/masters/lookups";
import { type JournalEntry, type JournalEntryLine } from "../api/ledger";

/**
 * IPC viewer ledger-lines table (spec §5, FR-SAL-010; brief §5.4). Mirrors the LED
 * Entry-viewer pattern with **one structural omission**: no `Godown` column (never
 * applicable to a `SALES_IPC`; a customer/AR/AIT/VAT/Revenue posting carries no godown —
 * this is *absent*, not an em-dash cell). Renders whatever the backend wrote — never
 * re-derives balance; never re-orders. Loading/403/other-error/empty share the same
 * card shell so the layout is stable. On ≥1024 renders the full 8-column grid; on
 * ≥768 (tablet) the four-dimension + party columns collapse behind a per-line
 * `Dimensions` expander (`<button>` with `aria-expanded`); on <768 (mobile) parent
 * screen renders `IpcLedgerLinesCards` instead.
 */
const GRID = "grid grid-cols-[40px_1.6fr_1fr_1fr_1fr_1.2fr_0.95fr_0.95fr]";

interface ViewerLine {
  id: string;
  lineNo: number;
  accountLabel: string;
  accountName: string;
  accountCode: string;
  project: string | null;
  costCentre: string | null;
  purpose: string | null;
  party: string | null;
  isControl: boolean; // has a party
  debit: string;
  credit: string;
}

function toViewerLine(line: JournalEntryLine, lookups: MasterLookups): ViewerLine {
  const accountFull = lookups.accountLabel(line.accountId) || line.accountId;
  const name = lookups.accountName(line.accountId) ?? line.accountId;
  const code = accountFull.includes(" — ") ? accountFull.split(" — ")[0] ?? "" : "";
  return {
    id: line.id,
    lineNo: line.lineNo,
    accountLabel: accountFull,
    accountName: name,
    accountCode: code,
    project: line.projectId ? lookups.project(line.projectId) || line.projectId : null,
    costCentre: line.costCentreId ? lookups.costCentre(line.costCentreId) || line.costCentreId : null,
    purpose: line.purposeId, // purposes are project-scoped, not resolved by the shared lookup
    party: line.partyId ? lookups.party(line.partyId) || `${line.partyId.slice(0, 8)} (name unavailable)` : null,
    isControl: !!line.partyId,
    debit: line.debit,
    credit: line.credit,
  };
}

export function IpcLedgerLinesTable({
  entry,
  isLoading,
  errorCode,
  ledgerHref,
  onRetry,
}: {
  entry: JournalEntry | undefined;
  isLoading: boolean;
  errorCode: "FORBIDDEN" | "OTHER" | null;
  ledgerHref: string | null;
  onRetry: () => void;
}) {
  const lookups = useMasterLookups();

  return (
    <section
      className="mt-4 overflow-hidden rounded-card border border-border bg-surface shadow-sm"
      data-testid="ipc-ledger-lines"
    >
      <header className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
        <span className="text-[13.5px] font-bold text-foreground">Ledger lines</span>
        <span className="hidden text-[11.5px] text-faint sm:inline">
          mirrors the posted journal entry · exactly one amount per line
        </span>
        {ledgerHref && !errorCode && !isLoading && entry ? (
          <Link
            href={ledgerHref}
            className="ml-auto inline-flex items-center gap-1 text-[12px] font-semibold text-accent-ink hover:underline"
            data-testid="ipc-view-in-ledger"
          >
            Open in ledger
            <ExternalLink className="h-3 w-3" aria-hidden />
          </Link>
        ) : null}
      </header>

      {isLoading ? (
        <div className="flex flex-col gap-2 p-5" data-testid="ipc-lines-loading">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : errorCode === "FORBIDDEN" ? (
        <Alert tone="warning" title="Ledger detail not available for your role." className="m-4" data-testid="ipc-lines-forbidden">
          <p className="mt-1 flex items-center gap-2 text-[12.5px]">
            <Lock className="h-3.5 w-3.5" aria-hidden />
            You don&rsquo;t have access to the ledger detail for this IPC. The header and key figures above are fully authoritative.
          </p>
        </Alert>
      ) : errorCode === "OTHER" ? (
        <Alert tone="destructive" title="Couldn't load the ledger lines." className="m-4" data-testid="ipc-lines-error">
          <p className="mt-1 flex items-center gap-2 text-[12.5px]">
            <AlertCircle className="h-3.5 w-3.5" aria-hidden />
            The header + key figures loaded, but the ledger detail didn&rsquo;t. Retry to try again.
          </p>
          <button
            type="button"
            onClick={onRetry}
            className="mt-2 inline-flex h-8 items-center rounded-token border border-border bg-surface px-3 text-[12px] font-semibold text-foreground hover:bg-muted"
            data-testid="ipc-lines-retry"
          >
            Retry
          </button>
        </Alert>
      ) : entry ? (
        <LinesGrid entry={entry} lookups={lookups} />
      ) : null}
    </section>
  );
}

function LinesGrid({ entry, lookups }: { entry: JournalEntry; lookups: MasterLookups }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const lines = entry.lines.map((l) => toViewerLine(l, lookups));

  return (
    <>
      {/* Desktop grid ≥1024 */}
      <div role="table" aria-label="Ledger lines" className="hidden overflow-x-auto lg:block" data-testid="ipc-lines-grid">
        <div role="row" className={cn(GRID, "border-b border-border-strong bg-surface-2")}>
          <HeaderCell>Line</HeaderCell>
          <HeaderCell>Account</HeaderCell>
          <HeaderCell>Project</HeaderCell>
          <HeaderCell>Cost centre</HeaderCell>
          <HeaderCell>Purpose</HeaderCell>
          <HeaderCell>Party</HeaderCell>
          <HeaderCell align="right">Debit ৳</HeaderCell>
          <HeaderCell align="right">Credit ৳</HeaderCell>
        </div>
        {lines.map((l) => (
          <div
            key={l.id}
            role="row"
            tabIndex={0}
            className={cn(GRID, "items-start border-t border-muted outline-none focus:bg-accent-soft/40")}
            data-testid={`ipc-line-${l.lineNo}`}
          >
            <Cell className="text-faint">{l.lineNo}</Cell>
            <div role="cell" tabIndex={0} className="min-w-0 px-3 py-3 outline-none">
              <div className="flex flex-wrap items-baseline gap-1.5">
                {l.accountCode ? (
                  <span className="font-mono text-[11.5px] font-medium text-accent-ink">{l.accountCode}</span>
                ) : null}
                <span className="text-[13px] font-medium leading-snug text-foreground">{l.accountName}</span>
              </div>
              <div className="mt-0.5 text-[11px] text-faint">{l.isControl ? "Control · customer" : "P&L / Tax"}</div>
            </div>
            <DimCell value={l.project} />
            <DimCell value={l.costCentre} />
            <DimCell value={l.purpose} />
            <div role="cell" tabIndex={0} className="min-w-0 px-3 py-3 outline-none">
              {l.party ? (
                <span className="bn text-[12.5px] leading-snug text-foreground [overflow-wrap:anywhere]">{l.party}</span>
              ) : (
                <span className="text-faint">—</span>
              )}
            </div>
            <MoneyCell value={l.debit} label="Debit" />
            <MoneyCell value={l.credit} label="Credit" />
          </div>
        ))}

        {/* Balanced totals footer */}
        <div className={cn(GRID, "items-center border-t-[1.5px] border-border-strong bg-surface-2")} data-testid="ipc-lines-totals">
          <div className="col-span-6 flex items-center gap-2 px-3 py-3.5">
            <span className="inline-flex items-center gap-1.5 rounded-pill bg-success-soft px-2.5 py-1 text-[11.5px] font-semibold text-success-ink">
              <CheckCircle2 className="h-3 w-3" aria-hidden />
              Balanced
            </span>
            <span className="text-[12.5px] text-muted-foreground">Total debit equals total credit</span>
          </div>
          <div className="px-3 py-2.5 text-right">
            <div className="text-[9.5px] font-semibold uppercase tracking-[0.4px] text-faint">Total debit ৳</div>
            <div className="mt-0.5 font-mono text-[14px] font-bold tabular-nums text-foreground">
              {formatMoney(entry.totalDebit, { withSymbol: false })}
            </div>
          </div>
          <div className="px-3 py-2.5 text-right">
            <div className="text-[9.5px] font-semibold uppercase tracking-[0.4px] text-faint">Total credit ৳</div>
            <div className="mt-0.5 font-mono text-[14px] font-bold tabular-nums text-foreground">
              {formatMoney(entry.totalCredit, { withSymbol: false })}
            </div>
          </div>
        </div>
      </div>

      {/* Tablet grid ≥768 <1024 — dimensions/party collapse into an expander */}
      <div role="table" aria-label="Ledger lines (compact)" className="hidden overflow-x-auto md:block lg:hidden" data-testid="ipc-lines-grid-tablet">
        <div role="row" className="grid grid-cols-[34px_1fr_1.05fr_1.05fr_36px] border-b border-border-strong bg-surface-2">
          <HeaderCell>Ln</HeaderCell>
          <HeaderCell>Account</HeaderCell>
          <HeaderCell align="right">Debit ৳</HeaderCell>
          <HeaderCell align="right">Credit ৳</HeaderCell>
          <div />
        </div>
        {lines.map((l) => {
          const open = expanded.has(l.id);
          return (
            <div key={l.id}>
              <div role="row" className="grid grid-cols-[34px_1fr_1.05fr_1.05fr_36px] items-center border-t border-muted">
                <Cell className="text-faint">{l.lineNo}</Cell>
                <div role="cell" className="min-w-0 px-3 py-3">
                  <div className="flex flex-wrap items-baseline gap-1.5">
                    {l.accountCode ? (
                      <span className="font-mono text-[11px] font-medium text-accent-ink">{l.accountCode}</span>
                    ) : null}
                    <span className="text-[12.5px] font-medium text-foreground">{l.accountName}</span>
                  </div>
                </div>
                <MoneyCell value={l.debit} label="Debit" />
                <MoneyCell value={l.credit} label="Credit" />
                <button
                  type="button"
                  aria-expanded={open}
                  aria-controls={`ipc-line-dims-${l.id}`}
                  aria-label={open ? "Hide dimensions" : "Show dimensions"}
                  onClick={() => setExpanded((s) => toggle(s, l.id))}
                  className="grid h-9 w-9 place-items-center text-faint hover:text-foreground"
                  data-testid={`ipc-line-expand-${l.lineNo}`}
                >
                  <ChevronRight className={cn("h-4 w-4 transition-transform", open && "rotate-90")} aria-hidden />
                </button>
              </div>
              {open ? (
                <div
                  id={`ipc-line-dims-${l.id}`}
                  className="border-t border-muted bg-surface-2 px-4 pb-3 pt-2"
                  data-testid={`ipc-line-dims-${l.lineNo}`}
                >
                  <div className="text-[9.5px] font-semibold uppercase tracking-[0.3px] text-faint">Dimensions</div>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {l.project ? <DimPill>{l.project}</DimPill> : null}
                    {l.costCentre ? <DimPill>{l.costCentre}</DimPill> : null}
                    {l.purpose ? <DimPill>{l.purpose}</DimPill> : null}
                    {l.party ? <PartyPill>{l.party}</PartyPill> : null}
                    {!l.project && !l.costCentre && !l.purpose && !l.party ? (
                      <span className="text-[12px] text-faint">No dimensions on this line</span>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
        <div className="flex items-center gap-3 border-t-[1.5px] border-border-strong bg-surface-2 px-3 py-3">
          <span className="inline-flex items-center gap-1.5 rounded-pill bg-success-soft px-2.5 py-1 text-[11.5px] font-semibold text-success-ink">
            <CheckCircle2 className="h-3 w-3" aria-hidden />
            Balanced
          </span>
          <div className="ml-auto flex gap-6">
            <div className="text-right">
              <div className="text-[9px] font-semibold uppercase tracking-[0.3px] text-faint">Debit ৳</div>
              <div className="font-mono text-[13.5px] font-bold tabular-nums">{formatMoney(entry.totalDebit, { withSymbol: false })}</div>
            </div>
            <div className="text-right">
              <div className="text-[9px] font-semibold uppercase tracking-[0.3px] text-faint">Credit ৳</div>
              <div className="font-mono text-[13.5px] font-bold tabular-nums">{formatMoney(entry.totalCredit, { withSymbol: false })}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile line cards <768 */}
      <div className="flex flex-col gap-2 p-3 md:hidden" data-testid="ipc-lines-cards">
        {lines.map((l) => {
          const isDr = Number(l.debit) !== 0;
          return (
            <div key={l.id} className="rounded-card border border-border bg-surface p-3 shadow-sm" data-testid={`ipc-line-card-${l.lineNo}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  {l.accountCode ? <span className="font-mono text-[11px] font-medium text-accent-ink">{l.accountCode}</span> : null}
                  <div className="text-[13.5px] font-semibold leading-snug text-foreground">{l.accountName}</div>
                </div>
                <div className="text-right">
                  <div className="text-[9px] font-semibold uppercase tracking-[0.3px] text-faint">{isDr ? "Debit ৳" : "Credit ৳"}</div>
                  <div className="mt-0.5 font-mono text-[14px] font-bold tabular-nums text-foreground">
                    {formatMoney(isDr ? l.debit : l.credit, { withSymbol: false })}
                  </div>
                </div>
              </div>
              <div className="mt-2.5 flex flex-wrap gap-1.5 border-t border-muted pt-2.5">
                {l.project ? <DimPill>{l.project}</DimPill> : null}
                {l.costCentre ? <DimPill>{l.costCentre}</DimPill> : null}
                {l.purpose ? <DimPill>{l.purpose}</DimPill> : null}
                {l.party ? <PartyPill>{l.party}</PartyPill> : null}
                {!l.project && !l.costCentre && !l.purpose && !l.party ? (
                  <span className="text-[11.5px] text-faint">No dimensions</span>
                ) : null}
              </div>
            </div>
          );
        })}
        <div className="mt-1 rounded-card border border-border bg-surface p-3 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[12.5px] text-muted-foreground">Total debit ৳</span>
            <span className="font-mono text-[14px] font-bold tabular-nums">{formatMoney(entry.totalDebit, { withSymbol: false })}</span>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-[12.5px] text-muted-foreground">Total credit ৳</span>
            <span className="font-mono text-[14px] font-bold tabular-nums">{formatMoney(entry.totalCredit, { withSymbol: false })}</span>
          </div>
          <div className="mt-3 border-t border-muted pt-3">
            <span className="inline-flex items-center gap-1.5 rounded-pill bg-success-soft px-2.5 py-1 text-[11.5px] font-semibold text-success-ink">
              <CheckCircle2 className="h-3 w-3" aria-hidden />
              Balanced
            </span>
          </div>
        </div>
      </div>
    </>
  );
}

function toggle(set: Set<string>, id: string): Set<string> {
  const copy = new Set(set);
  if (copy.has(id)) copy.delete(id);
  else copy.add(id);
  return copy;
}

function HeaderCell({ children, align }: { children: React.ReactNode; align?: "right" }) {
  return (
    <div role="columnheader" className={cn("px-3 py-2.5 text-[10px] font-semibold uppercase tracking-[0.4px] text-muted-foreground", align === "right" && "text-right")}>
      {children}
    </div>
  );
}

function Cell({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div role="cell" tabIndex={0} className={cn("px-3 py-3 text-[13px] tabular-nums outline-none", className)}>
      {children}
    </div>
  );
}

function DimCell({ value }: { value: string | null }) {
  return (
    <div role="cell" tabIndex={0} className="px-3 py-3 outline-none">
      {value ? (
        <span className="inline-flex items-center rounded-pill bg-accent-soft px-2.5 py-0.5 text-[11px] font-semibold text-accent-ink">
          {value}
        </span>
      ) : (
        <span className="text-faint">—</span>
      )}
    </div>
  );
}

function MoneyCell({ value, label }: { value: string; label: string }) {
  const isZero = Number(value) === 0;
  return (
    <div role="cell" tabIndex={0} className="px-3 py-3 text-right outline-none">
      <span
        className={cn("font-mono text-[13px] font-semibold tabular-nums", isZero ? "text-faint" : "text-foreground")}
        aria-label={`${label} ${formatMoney(value)}`}
      >
        {isZero ? "—" : formatMoney(value, { withSymbol: false })}
      </span>
    </div>
  );
}

function DimPill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-pill bg-accent-soft px-2.5 py-0.5 text-[11px] font-semibold text-accent-ink">
      {children}
    </span>
  );
}

function PartyPill({ children }: { children: React.ReactNode }) {
  return (
    <span className="bn inline-flex items-center rounded-pill bg-muted px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground [overflow-wrap:anywhere]">
      {children}
    </span>
  );
}
