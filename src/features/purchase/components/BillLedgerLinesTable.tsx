"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatMoney, toDecimal } from "@/lib/money";
import { money } from "../format";
import { type JournalEntryDetailLine } from "@/features/ledger/types";

/**
 * Bill-viewer ledger-lines table (brief §Scope 9; Purchase Bill.dc.html viewer). Mirrors the
 * LED entry — Account (code + name, two-part) · Dimensions (lime chips) · Party · Dr ৳ · Cr ৳ —
 * closing on a balanced footer that carries the "Balanced · Total Dr = Total Cr" pill on the
 * left and the Totals on the right. The viewer displays what the backend wrote — it never
 * re-derives or asserts Σdr=Σcr. IDs are resolved to display names via the shared master
 * lookups (`resolve`), degrading to the raw ID when a lookup misses. At ≥768 the dimensions +
 * party collapse into a per-line expander (mirroring the Entry viewer's tablet behaviour).
 */
// Column ramp mirrors the design: Account 1.55fr · Dimensions 1.7fr · Party 1.05fr · Dr/Cr 116px.
const GRID = "grid-cols-[minmax(0,1.55fr)_minmax(0,1.7fr)_1.05fr_116px_116px]";

const DASH = <span className="text-faint">—</span>;

/** ID → display resolvers, supplied by the viewer from the shared master lookups. */
export interface LedgerLineResolve {
  /** "1400 — Inventory — Construction materials" split into { code, name }. */
  account: (id: string) => { code: string; name: string | null };
  party: (id: string | null) => string | null;
  project: (id: string | null) => string | null;
  costCentre: (id: string | null) => string | null;
  purpose: (id: string | null) => string | null;
  godown: (id: string | null) => string | null;
}

/** Ordered dimension chip values for a ledger line (godown · cost centre · purpose · project). */
function dimensionChips(line: JournalEntryDetailLine, resolve: LedgerLineResolve): string[] {
  return [
    resolve.godown(line.godownId),
    resolve.costCentre(line.costCentreId),
    resolve.purpose(line.purposeId),
    resolve.project(line.projectId),
  ].filter((v): v is string => !!v);
}

/** Lime dimension chip — `bg-accent-soft` + `accent-ink`, matching the design's tag. */
function DimensionChip({ value }: { value: string }) {
  return (
    <span className="inline-flex h-5 items-center whitespace-nowrap rounded-[5px] bg-accent-soft px-2 text-[11px] font-medium text-accent-ink">
      {value}
    </span>
  );
}

/** Two-part account cell — lime `accent-ink` code + foreground name (falls back to the id). */
function AccountCell({ id, resolve }: { id: string; resolve: LedgerLineResolve }) {
  const { code, name } = resolve.account(id);
  return (
    <div className="flex flex-wrap items-baseline gap-x-[7px] gap-y-0.5">
      <span className="font-mono text-[12px] font-medium text-accent-ink">{code}</span>
      {name && <span className="text-[13px] leading-[1.35] text-foreground">{name}</span>}
    </div>
  );
}

export function BillLedgerLinesTable({
  lines,
  resolve,
}: {
  lines: JournalEntryDetailLine[];
  resolve: LedgerLineResolve;
}) {
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
      <div role="table" aria-label="Journal entry lines" className="hidden overflow-x-auto lg:block">
        <div role="row" className={cn("grid border-b border-border-strong bg-surface-2", GRID)}>
          <HeaderCell>Account</HeaderCell>
          <HeaderCell>Dimensions</HeaderCell>
          <HeaderCell>Party</HeaderCell>
          <HeaderCell align="right">Dr ৳</HeaderCell>
          <HeaderCell align="right">Cr ৳</HeaderCell>
        </div>
        {lines.map((line) => {
          const chips = dimensionChips(line, resolve);
          const party = resolve.party(line.partyId);
          return (
            <div
              key={line.id}
              role="row"
              tabIndex={0}
              className={cn("grid items-start border-t border-muted outline-none focus:bg-accent-soft", GRID)}
              data-testid={`bill-ledger-line-${line.lineNo}`}
            >
              <div role="cell" className="min-w-0 px-[14px] py-[13px]">
                <AccountCell id={line.accountId} resolve={resolve} />
              </div>
              <div role="cell" className="min-w-0 px-3 py-[11px]">
                {chips.length > 0 ? (
                  <div className="flex flex-wrap gap-[5px]">
                    {chips.map((c, i) => (
                      <DimensionChip key={i} value={c} />
                    ))}
                  </div>
                ) : (
                  <span className="text-[12.5px] text-faint">—</span>
                )}
              </div>
              <div role="cell" className="px-3 py-[13px] text-[12.5px] leading-[1.35] text-foreground">
                {party ?? DASH}
              </div>
              <div role="cell" className="px-3 py-[13px] text-right">
                <Money value={line.debit} label="Debit" />
              </div>
              <div role="cell" className="px-[14px] py-[13px] text-right">
                <Money value={line.credit} label="Credit" />
              </div>
            </div>
          );
        })}
        <div
          role="row"
          className={cn("grid items-center border-t-[1.5px] border-border-strong bg-surface-2", GRID)}
          data-testid="bill-ledger-totals"
        >
          <div role="cell" className="col-span-2 flex items-center gap-[9px] px-[14px] py-[13px]">
            <span
              className="inline-flex h-[23px] items-center gap-1.5 rounded-pill bg-success-soft px-[11px]"
              data-testid="bill-ledger-balanced"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-success" aria-hidden />
              <span className="text-[11.5px] font-semibold text-success-ink">Balanced</span>
            </span>
            <span className="text-[12.5px] text-muted-foreground">Total Dr = Total Cr</span>
          </div>
          <div
            role="cell"
            className="self-center px-3 py-[13px] text-right text-[11px] font-semibold uppercase tracking-[0.3px] text-faint"
          >
            Totals
          </div>
          <div role="cell" className="px-3 py-[13px] text-right">
            <Money value={totals.debit.toFixed(4)} label="Total debit" bold />
          </div>
          <div role="cell" className="px-[14px] py-[13px] text-right">
            <Money value={totals.credit.toFixed(4)} label="Total credit" bold />
          </div>
        </div>
      </div>

      {/* ≥md but <lg — dimensions expander */}
      <div className="hidden md:block lg:hidden">
        <TabletLines lines={lines} totals={totals} resolve={resolve} />
      </div>

      {/* <md — stacked cards */}
      <div className="flex flex-col gap-2.5 md:hidden">
        {lines.map((line) => {
          const isDebit = Number(line.debit) !== 0;
          const { code, name } = resolve.account(line.accountId);
          const chips = dimensionChips(line, resolve);
          const party = resolve.party(line.partyId);
          return (
            <div
              key={line.id}
              className="rounded-card border border-border bg-surface p-3.5 shadow-sm"
              data-testid={`bill-ledger-card-${line.lineNo}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <span className="font-mono text-[12px] font-medium text-accent-ink">{code}</span>
                  <div className="text-[13.5px] font-semibold text-foreground [overflow-wrap:anywhere]">
                    {name ?? code}
                  </div>
                </div>
                <div className="flex-none text-right">
                  <div className="text-[9px] font-semibold uppercase tracking-[0.3px] text-faint">
                    {isDebit ? "Dr ৳" : "Cr ৳"}
                  </div>
                  <Money value={isDebit ? line.debit : line.credit} label={isDebit ? "Debit" : "Credit"} bold />
                </div>
              </div>
              {(chips.length > 0 || party) && (
                <div className="mt-2.5 flex flex-wrap gap-1.5 border-t border-muted pt-2.5">
                  {chips.map((c, i) => (
                    <DimensionChip key={i} value={c} />
                  ))}
                  {party && (
                    <span className="inline-flex h-5 items-center whitespace-nowrap rounded-[5px] border border-muted bg-surface px-2 text-[11px] text-foreground">
                      {party}
                    </span>
                  )}
                </div>
              )}
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
  resolve,
}: {
  lines: JournalEntryDetailLine[];
  totals: { debit: ReturnType<typeof toDecimal>; credit: ReturnType<typeof toDecimal> };
  resolve: LedgerLineResolve;
}) {
  return (
    <div>
      <div className="grid grid-cols-[1fr_100px_100px] border-b border-border-strong bg-surface-2">
        <HeaderCell>Account</HeaderCell>
        <HeaderCell align="right">Dr ৳</HeaderCell>
        <HeaderCell align="right">Cr ৳</HeaderCell>
      </div>
      {lines.map((line) => (
        <TabletRow key={line.id} line={line} resolve={resolve} />
      ))}
      <div
        className="grid grid-cols-[1fr_100px_100px] items-center border-t-[1.5px] border-border-strong bg-surface-2"
        data-testid="bill-ledger-totals-tablet"
      >
        <div className="flex items-center gap-2 px-4 py-3">
          <span className="inline-flex h-[23px] items-center gap-1.5 rounded-pill bg-success-soft px-[11px]">
            <span className="h-1.5 w-1.5 rounded-full bg-success" aria-hidden />
            <span className="text-[11.5px] font-semibold text-success-ink">Balanced</span>
          </span>
        </div>
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

function TabletRow({ line, resolve }: { line: JournalEntryDetailLine; resolve: LedgerLineResolve }) {
  const [open, setOpen] = useState(false);
  const { code, name } = resolve.account(line.accountId);
  const chips = dimensionChips(line, resolve);
  const party = resolve.party(line.partyId);
  return (
    <div className="border-t border-muted">
      <div className="grid grid-cols-[1fr_100px_100px] items-start">
        <div className="px-4 py-3">
          <button
            type="button"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="flex items-start gap-1.5 text-left hover:text-accent-ink"
            data-testid={`bill-ledger-dim-toggle-${line.lineNo}`}
          >
            {open ? (
              <ChevronDown className="mt-0.5 h-3.5 w-3.5 flex-none" aria-hidden />
            ) : (
              <ChevronRight className="mt-0.5 h-3.5 w-3.5 flex-none" aria-hidden />
            )}
            <span className="flex flex-wrap items-baseline gap-x-[7px]">
              <span className="font-mono text-[12px] font-medium text-accent-ink">{code}</span>
              {name && <span className="text-[13px] text-foreground">{name}</span>}
            </span>
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
        <div className="flex flex-wrap gap-1.5 border-t border-muted bg-surface-2 px-4 py-3">
          {chips.map((c, i) => (
            <DimensionChip key={i} value={c} />
          ))}
          {party && (
            <span className="inline-flex h-5 items-center whitespace-nowrap rounded-[5px] border border-muted bg-surface px-2 text-[11px] text-foreground">
              {party}
            </span>
          )}
          {chips.length === 0 && !party && <span className="text-[12px] text-faint">No dimensions</span>}
        </div>
      )}
    </div>
  );
}

function Money({ value, label, bold }: { value: string; label: string; bold?: boolean }) {
  const isZero = Number(value) === 0;
  return (
    <span
      className={cn(
        "font-mono text-[13px] tabular-nums",
        bold ? "font-bold text-foreground" : isZero ? "font-normal text-faint" : "font-medium text-foreground",
      )}
      aria-label={`${label} ${formatMoney(value)}`}
    >
      {isZero ? DASH : money(value)}
    </span>
  );
}

function HeaderCell({ children, align }: { children: React.ReactNode; align?: "right" }) {
  return (
    <div
      role="columnheader"
      className={cn(
        "px-[14px] py-[11px] text-[10.5px] font-semibold uppercase tracking-[0.4px] text-muted-foreground",
        align === "right" && "text-right",
      )}
    >
      {children}
    </div>
  );
}
