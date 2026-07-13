"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatMoney, toDecimal } from "@/lib/money";
import { type JournalEntryDetailLine } from "@/features/ledger/types";

/**
 * Bill-viewer ledger-lines table (brief §Scope 9). Mirrors the LED Entry viewer's
 * layout — Line · Account · Project · Cost centre · Purpose · Godown · Party · Debit ৳
 * · Credit ৳ — with a balanced totals footer. The viewer displays what the backend
 * wrote — it never re-derives or asserts Σdr=Σcr. At ≥1024 the full grid renders;
 * at ≥768 the four dimensions + party collapse into a per-line "Dimensions" expander
 * (mirroring the Entry viewer's tablet behaviour).
 */
const GRID = "grid-cols-[44px_1.6fr_1fr_1fr_1fr_1fr_1fr_0.9fr_0.9fr]";

const DASH = <span className="text-faint">—</span>;

function dim(value: string | null | undefined): React.ReactNode {
  return value ?? DASH;
}

export function BillLedgerLinesTable({ lines }: { lines: JournalEntryDetailLine[] }) {
  const totals = lines.reduce(
    (acc, l) => ({
      debit: acc.debit.plus(toDecimal(l.debit || "0")),
      credit: acc.credit.plus(toDecimal(l.credit || "0")),
    }),
    { debit: toDecimal("0"), credit: toDecimal("0") },
  );

  return (
    <div data-testid="bill-ledger-lines">
      {/* ≥lg full grid */}
      <div
        role="table"
        aria-label="Journal entry lines"
        className="hidden overflow-x-auto lg:block"
      >
        <div role="row" className={cn("grid border-b border-border-strong bg-surface-2", GRID)}>
          <HeaderCell>Line</HeaderCell>
          <HeaderCell>Account</HeaderCell>
          <HeaderCell>Project</HeaderCell>
          <HeaderCell>Cost centre</HeaderCell>
          <HeaderCell>Purpose</HeaderCell>
          <HeaderCell>Godown</HeaderCell>
          <HeaderCell>Party</HeaderCell>
          <HeaderCell align="right">Debit ৳</HeaderCell>
          <HeaderCell align="right">Credit ৳</HeaderCell>
        </div>
        {lines.map((line) => (
          <div
            key={line.id}
            role="row"
            tabIndex={0}
            className={cn("grid items-start border-t border-muted outline-none focus:bg-accent-soft", GRID)}
            data-testid={`bill-ledger-line-${line.lineNo}`}
          >
            <div role="cell" className="px-4 py-3 text-[13px] tabular-nums text-faint">
              {line.lineNo}
            </div>
            <div role="cell" className="min-w-0 px-4 py-3 text-[13px] text-foreground [overflow-wrap:anywhere]">
              {line.accountId}
            </div>
            <div role="cell" className="px-4 py-3 text-[12.5px] text-foreground">{dim(line.projectId)}</div>
            <div role="cell" className="px-4 py-3 text-[12.5px] text-foreground">{dim(line.costCentreId)}</div>
            <div role="cell" className="px-4 py-3 text-[12.5px] text-foreground">{dim(line.purposeId)}</div>
            <div role="cell" className="px-4 py-3 text-[12.5px] text-foreground">{dim(line.godownId)}</div>
            <div role="cell" className="px-4 py-3 text-[12.5px] text-foreground">{dim(line.partyId)}</div>
            <div role="cell" className="px-4 py-3 text-right">
              <Money value={line.debit} label="Debit" />
            </div>
            <div role="cell" className="px-4 py-3 text-right">
              <Money value={line.credit} label="Credit" />
            </div>
          </div>
        ))}
        <div
          role="row"
          className={cn("grid border-t-2 border-border-strong bg-surface-2 font-semibold", GRID)}
          data-testid="bill-ledger-totals"
        >
          <div role="cell" className="px-4 py-3 text-[12.5px] uppercase tracking-[0.4px] text-muted-foreground">
            Totals
          </div>
          <div role="cell" className="px-4 py-3" />
          <div role="cell" className="px-4 py-3" />
          <div role="cell" className="px-4 py-3" />
          <div role="cell" className="px-4 py-3" />
          <div role="cell" className="px-4 py-3" />
          <div role="cell" className="px-4 py-3" />
          <div role="cell" className="px-4 py-3 text-right">
            <Money value={totals.debit.toFixed(4)} label="Total debit" bold />
          </div>
          <div role="cell" className="px-4 py-3 text-right">
            <Money value={totals.credit.toFixed(4)} label="Total credit" bold />
          </div>
        </div>
      </div>

      {/* ≥md but <lg — dimensions expander */}
      <div className="hidden md:block lg:hidden">
        <TabletLines lines={lines} totals={totals} />
      </div>

      {/* <md — stacked cards */}
      <div className="flex flex-col gap-2.5 md:hidden">
        {lines.map((line) => {
          const isDebit = Number(line.debit) !== 0;
          return (
            <div
              key={line.id}
              className="rounded-card border border-border bg-surface p-3.5 shadow-sm"
              data-testid={`bill-ledger-card-${line.lineNo}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.4px] text-faint">
                    Line {line.lineNo}
                  </span>
                  <div className="text-[13.5px] font-semibold text-foreground [overflow-wrap:anywhere]">
                    {line.accountId}
                  </div>
                </div>
                <div className="flex-none text-right">
                  <div className="text-[9px] font-semibold uppercase tracking-[0.3px] text-faint">
                    {isDebit ? "Debit ৳" : "Credit ৳"}
                  </div>
                  <Money value={isDebit ? line.debit : line.credit} label={isDebit ? "Debit" : "Credit"} bold />
                </div>
              </div>
              <div className="mt-2.5 flex flex-wrap gap-1.5 border-t border-muted pt-2.5">
                <Chip label="Project" value={line.projectId} />
                <Chip label="Cost centre" value={line.costCentreId} />
                <Chip label="Purpose" value={line.purposeId} />
                <Chip label="Godown" value={line.godownId} />
                <Chip label="Party" value={line.partyId} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TabletLines({
  lines,
  totals,
}: {
  lines: JournalEntryDetailLine[];
  totals: { debit: ReturnType<typeof toDecimal>; credit: ReturnType<typeof toDecimal> };
}) {
  return (
    <div>
      <div className="grid grid-cols-[44px_1fr_100px_100px] border-b border-border-strong bg-surface-2">
        <HeaderCell>Line</HeaderCell>
        <HeaderCell>Account</HeaderCell>
        <HeaderCell align="right">Debit ৳</HeaderCell>
        <HeaderCell align="right">Credit ৳</HeaderCell>
      </div>
      {lines.map((line) => (
        <TabletRow key={line.id} line={line} />
      ))}
      <div
        className="grid grid-cols-[44px_1fr_100px_100px] border-t-2 border-border-strong bg-surface-2 font-semibold"
        data-testid="bill-ledger-totals-tablet"
      >
        <div className="px-4 py-3 text-[12.5px] uppercase tracking-[0.4px] text-muted-foreground">Totals</div>
        <div className="px-4 py-3" />
        <div className="px-4 py-3 text-right">
          <Money value={totals.debit.toFixed(4)} label="Total debit" bold />
        </div>
        <div className="px-4 py-3 text-right">
          <Money value={totals.credit.toFixed(4)} label="Total credit" bold />
        </div>
      </div>
    </div>
  );
}

function TabletRow({ line }: { line: JournalEntryDetailLine }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-t border-muted">
      <div className="grid grid-cols-[44px_1fr_100px_100px] items-start">
        <div className="px-4 py-3 text-[13px] tabular-nums text-faint">{line.lineNo}</div>
        <div className="px-4 py-3 text-[13px] text-foreground [overflow-wrap:anywhere]">
          <button
            type="button"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="flex items-center gap-1.5 text-left font-semibold text-foreground hover:text-accent-ink"
            data-testid={`bill-ledger-dim-toggle-${line.lineNo}`}
          >
            {open ? <ChevronDown className="h-3.5 w-3.5" aria-hidden /> : <ChevronRight className="h-3.5 w-3.5" aria-hidden />}
            {line.accountId}
          </button>
        </div>
        <div className="px-4 py-3 text-right">
          <Money value={line.debit} label="Debit" />
        </div>
        <div className="px-4 py-3 text-right">
          <Money value={line.credit} label="Credit" />
        </div>
      </div>
      {open && (
        <div className="grid grid-cols-2 gap-2 border-t border-muted bg-surface-2 px-4 py-3 md:grid-cols-5">
          <Chip label="Project" value={line.projectId} />
          <Chip label="Cost centre" value={line.costCentreId} />
          <Chip label="Purpose" value={line.purposeId} />
          <Chip label="Godown" value={line.godownId} />
          <Chip label="Party" value={line.partyId} />
        </div>
      )}
    </div>
  );
}

function Chip({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-sm border border-muted bg-surface px-2 py-1">
      <span className="text-[9px] font-semibold uppercase tracking-[0.3px] text-faint">{label}</span>
      <span className="text-[11.5px] text-foreground">{value ?? DASH}</span>
    </span>
  );
}

function Money({ value, label, bold }: { value: string; label: string; bold?: boolean }) {
  const isZero = Number(value) === 0;
  return (
    <span
      className={cn(
        "font-mono text-[13px] tabular-nums",
        bold ? "font-bold" : "font-semibold",
        isZero ? "text-faint" : "text-foreground",
      )}
      aria-label={`${label} ${formatMoney(value)}`}
    >
      {formatMoney(value, { withSymbol: false })}
    </span>
  );
}

function HeaderCell({ children, align }: { children: React.ReactNode; align?: "right" }) {
  return (
    <div
      role="columnheader"
      className={cn(
        "px-4 py-2.5 text-[10.5px] font-semibold uppercase tracking-[0.4px] text-muted-foreground",
        align === "right" && "text-right",
      )}
    >
      {children}
    </div>
  );
}
