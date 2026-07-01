"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/money";
import { type GroupByOption } from "../schemas/trial-balance-filter.schema";
import { type TrialBalanceRow, type TrialBalanceTotals } from "../types";

/**
 * Trial-balance grouped-balances table (spec §4/§5/§10; design file grid). READ-ONLY
 * — rows drill into the Account ledger, pre-scoped to the applied date/FY/period
 * (spec §9). One column per dimension actually present in the currently-applied
 * `groupBy` (else that column is omitted entirely, spec §5); Debit/Credit/Net are
 * always right-aligned `৳ Decimal(18,4)` via `formatMoney` (never float). Sticky
 * header + sticky totals footer (mirrors `LedgerLinesTable`'s ARIA div-grid
 * convention — `role="row"`/`role="columnheader"`, not a literal `<table>`).
 * Dimension ids are rendered raw (no master-data name resolution available to this
 * feature — the established pattern, see `LedgerLinesTable`'s `dimensionChips`).
 */

const DIMENSION_COLUMNS: { key: GroupByOption; field: keyof TrialBalanceRow; label: string }[] = [
  { key: "project", field: "projectId", label: "Project" },
  { key: "cost_centre", field: "costCentreId", label: "Cost centre" },
  { key: "purpose", field: "purposeId", label: "Purpose" },
  { key: "godown", field: "godownId", label: "Godown" },
  { key: "party", field: "partyId", label: "Party" },
];

function accountLedgerHref(row: TrialBalanceRow, dateScope: DateScope): string {
  const p = new URLSearchParams();
  p.set("accountId", row.accountId);
  if (dateScope.periodId) p.set("periodId", dateScope.periodId);
  if (dateScope.financialYearId) p.set("financialYearId", dateScope.financialYearId);
  if (dateScope.dateFrom) p.set("dateFrom", dateScope.dateFrom);
  if (dateScope.dateTo) p.set("dateTo", dateScope.dateTo);
  return `/ledger/account-ledger?${p.toString()}`;
}

export interface DateScope {
  financialYearId?: string;
  periodId?: string;
  dateFrom?: string;
  dateTo?: string;
}

export function TrialBalanceTable({
  rows,
  totals,
  groupBy,
  dateScope,
}: {
  rows: TrialBalanceRow[];
  totals: TrialBalanceTotals;
  groupBy: GroupByOption[];
  dateScope: DateScope;
}) {
  const router = useRouter();
  const activeDimensionCols = DIMENSION_COLUMNS.filter((c) => groupBy.includes(c.key));
  const gridTemplate = `2fr ${activeDimensionCols.map(() => "1fr").join(" ")} 1fr 1fr 1fr`.trim();
  const balanced = totals.debit === totals.credit;

  return (
    <>
      {/* Desktop / tablet grid */}
      <div role="table" aria-label="Trial balance" className="hidden md:block" data-testid="tb-desktop">
        <div
          role="row"
          className="sticky top-0 z-[2] grid border-b border-border-strong bg-surface-2"
          style={{ gridTemplateColumns: gridTemplate }}
        >
          <HeaderCell>Account</HeaderCell>
          {activeDimensionCols.map((c) => (
            <HeaderCell key={c.key}>{c.label}</HeaderCell>
          ))}
          <HeaderCell align="right">Debit ৳</HeaderCell>
          <HeaderCell align="right">Credit ৳</HeaderCell>
          <HeaderCell align="right">Net ৳</HeaderCell>
        </div>

        {rows.map((row) => {
          const net = Number(row.net);
          const negative = net < 0;
          return (
            <div
              key={`${row.accountId}-${row.projectId ?? ""}-${row.costCentreId ?? ""}-${row.purposeId ?? ""}-${row.godownId ?? ""}-${row.partyId ?? ""}`}
              role="row"
              tabIndex={0}
              onClick={() => router.push(accountLedgerHref(row, dateScope))}
              onKeyDown={(ev) => {
                if (ev.key === "Enter") {
                  ev.preventDefault();
                  router.push(accountLedgerHref(row, dateScope));
                }
              }}
              className="grid cursor-pointer items-center border-b border-border outline-none focus:bg-accent-soft hover:bg-surface-2"
              style={{ gridTemplateColumns: gridTemplate }}
              data-testid={`tb-row-${row.accountId}`}
            >
              <div className="min-w-0 px-4 py-2.5">
                <Link
                  href={accountLedgerHref(row, dateScope)}
                  onClick={(ev) => ev.stopPropagation()}
                  className="block truncate font-mono text-[13px] font-semibold text-accent-ink hover:underline"
                  title={row.accountId}
                >
                  {row.accountId}
                </Link>
              </div>
              {activeDimensionCols.map((c) => {
                const value = row[c.field] as string | null;
                return (
                  <div key={c.key} className="min-w-0 px-4 py-2.5">
                    {value ? (
                      <span className="block truncate text-[12.5px] text-foreground" title={value}>
                        {value}
                      </span>
                    ) : (
                      <span className="text-[12.5px] text-faint">—</span>
                    )}
                  </div>
                );
              })}
              <div className="px-4 py-2.5 text-right">
                <Money value={row.debit} label="Debit" />
              </div>
              <div className="px-4 py-2.5 text-right">
                <Money value={row.credit} label="Credit" />
              </div>
              <div className="px-4 py-2.5 text-right">
                <Money value={row.net} label="Net" bold negative={negative} />
              </div>
            </div>
          );
        })}

        {/* sticky totals footer */}
        <div
          role="row"
          aria-label="Totals"
          className="sticky bottom-0 grid items-center border-t-2 border-border-strong bg-surface-2"
          style={{ gridTemplateColumns: gridTemplate }}
          data-testid="tb-totals-row"
        >
          <div className="flex items-center gap-2.5 px-4 py-2.5">
            <span className="text-[12.5px] font-bold uppercase tracking-[0.4px] text-foreground">Total</span>
            <span
              className={cn(
                "inline-flex h-[22px] items-center gap-1.5 rounded-pill px-2",
                balanced ? "bg-success-soft" : "bg-destructive-soft",
              )}
            >
              <span className={cn("h-1.5 w-1.5 rounded-full", balanced ? "bg-success" : "bg-destructive")} />
              <span
                className={cn("text-[11px] font-semibold", balanced ? "text-success-ink" : "text-destructive-ink")}
              >
                {balanced ? "Balanced" : "Out of balance"}
              </span>
            </span>
          </div>
          {activeDimensionCols.map((c) => (
            <div key={c.key} className="px-4 py-2.5" />
          ))}
          <div
            className="px-4 py-2.5 text-right font-mono text-[13.5px] font-bold tabular-nums text-foreground"
            aria-label={`Total debit ${formatMoney(totals.debit)}`}
          >
            {formatMoney(totals.debit)}
          </div>
          <div
            className="px-4 py-2.5 text-right font-mono text-[13.5px] font-bold tabular-nums text-foreground"
            aria-label={`Total credit ${formatMoney(totals.credit)}`}
          >
            {formatMoney(totals.credit)}
          </div>
          <div className="px-4 py-2.5 text-right font-mono text-[13.5px] font-bold tabular-nums text-foreground">
            {formatMoney((Number(totals.debit) - Number(totals.credit)).toFixed(4))}
          </div>
        </div>
      </div>

      {/* Mobile read-only cards (≥360) — back-office, desktop/tablet primary (spec §4) */}
      <div className="flex flex-col gap-2.5 md:hidden" data-testid="tb-mobile">
        {rows.map((row) => (
          <Link
            key={`${row.accountId}-${row.projectId ?? ""}-${row.costCentreId ?? ""}-${row.purposeId ?? ""}-${row.godownId ?? ""}-${row.partyId ?? ""}`}
            href={accountLedgerHref(row, dateScope)}
            className="block rounded-card border border-border bg-surface p-3.5 shadow-sm hover:bg-surface-2"
            data-testid={`tb-card-${row.accountId}`}
          >
            <div className="font-mono text-[13px] font-semibold text-accent-ink" title={row.accountId}>
              {row.accountId}
            </div>
            <dl className="mt-2.5 flex flex-col gap-2 border-t border-muted pt-2.5">
              <MobileRow label="Debit" value={formatMoney(row.debit)} />
              <MobileRow label="Credit" value={formatMoney(row.credit)} />
              <MobileRow label="Net" value={formatMoney(row.net)} accent negative={Number(row.net) < 0} />
            </dl>
          </Link>
        ))}
      </div>
    </>
  );
}

function Money({
  value,
  label,
  bold,
  negative,
}: {
  value: string;
  label: string;
  bold?: boolean;
  negative?: boolean;
}) {
  const isZero = value === "0" || Number(value) === 0;
  return (
    <span
      className={cn(
        "font-mono text-[13px] tabular-nums",
        bold ? "font-bold" : "font-semibold",
        negative ? "text-destructive-ink" : isZero ? "text-faint" : "text-foreground",
      )}
      aria-label={`${label} ${formatMoney(value)}`}
    >
      {negative ? `(${formatMoney(value.replace("-", ""), { withSymbol: false })})` : formatMoney(value, { withSymbol: false })}
    </span>
  );
}

function HeaderCell({ children, align }: { children: React.ReactNode; align?: "right" }) {
  return (
    <div
      role="columnheader"
      className={cn(
        "flex h-11 items-center px-4 text-[11px] font-semibold uppercase tracking-[0.4px] text-muted-foreground",
        align === "right" && "justify-end",
      )}
    >
      {children}
    </div>
  );
}

function MobileRow({
  label,
  value,
  accent,
  negative,
}: {
  label: string;
  value: string;
  accent?: boolean;
  negative?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2.5">
      <dt className="text-[11px] font-semibold uppercase tracking-[0.4px] text-faint">{label}</dt>
      <dd
        className={cn(
          "text-right font-mono text-[12.5px] tabular-nums",
          negative ? "text-destructive-ink" : accent ? "font-bold text-foreground" : "text-muted-foreground",
        )}
      >
        {value}
      </dd>
    </div>
  );
}
