"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { MoreHorizontal, ArrowUpRight, FileText, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import { type LedgerLine, voucherTypeLabel } from "../types";
import { type MasterLookups } from "@/lib/masters/lookups";

/**
 * Account-ledger / drill-down lines table (spec §4/§5/§10; design file grid).
 * READ-ONLY — rows open the Entry viewer; the kebab links to the source voucher and
 * carries the informational "To correct, reverse the source voucher" note (never an
 * edit control). In account-ledger mode a synthesised "Opening balance" first row
 * seeds the running-balance column; both are omitted in drill-down mode (spec §13).
 * Money + running balance: right-aligned ৳ Decimal(18,4) via formatMoney (never
 * float), with accessible labels. Reversal lines carry a text-labelled badge.
 */

// Columns differ by mode: account-ledger includes the Running-balance column.
// Widths match Account Ledger.dc.html gridCols.
const GRID_LEDGER = "grid-cols-[0.82fr_1.32fr_2.15fr_1.1fr_0.95fr_0.95fr_1.08fr_44px]";
const GRID_DRILL = "grid-cols-[0.82fr_1.32fr_2.15fr_1.1fr_0.95fr_0.95fr_44px]";

function entryHref(entryId: string): string {
  return `/ledger/entry-viewer?id=${entryId}`;
}
function sourceHref(sourceType: string | null, sourceId: string | null): string | null {
  if (!sourceType || !sourceId) return null;
  return `/vouchers/${sourceType.toLowerCase()}/${sourceId}`;
}

/** Dimension chips — only set dimensions shown. Project/cost-centre resolve to names
 * via `names`; purpose/godown are project-scoped and fall back to their id. */
function dimensionChips(line: LedgerLine, names: MasterLookups): { k: string; v: string }[] {
  const chips: { k: string; v: string }[] = [];
  if (line.projectId) chips.push({ k: "PRJ", v: names.project(line.projectId) });
  if (line.costCentreId) chips.push({ k: "CC", v: names.costCentre(line.costCentreId) });
  if (line.purposeId) chips.push({ k: "PUR", v: line.purposeId });
  if (line.godownId) chips.push({ k: "GDN", v: line.godownId });
  return chips;
}

export function LedgerLinesTable({
  lines,
  openingBalance,
  accountLedgerMode,
  names,
}: {
  lines: LedgerLine[];
  openingBalance?: string | null;
  accountLedgerMode: boolean;
  names: MasterLookups;
}) {
  const router = useRouter();
  const grid = accountLedgerMode ? GRID_LEDGER : GRID_DRILL;

  return (
    <>
      {/* Desktop / tablet grid */}
      <div
        role="table"
        aria-label={accountLedgerMode ? "Account ledger" : "Ledger drill-down"}
        className="hidden md:block"
        data-testid="ledger-desktop"
      >
        <div role="row" className={cn("sticky top-0 z-[2] grid border-b border-border-strong bg-surface-2", grid)}>
          <HeaderCell sort="active">Date</HeaderCell>
          <HeaderCell sort="idle">Entry no</HeaderCell>
          <HeaderCell>Narration</HeaderCell>
          <HeaderCell>Party</HeaderCell>
          <HeaderCell align="right" sort="idle">Debit ৳</HeaderCell>
          <HeaderCell align="right" sort="idle">Credit ৳</HeaderCell>
          {accountLedgerMode && <HeaderCell align="right">Running balance ৳</HeaderCell>}
          <div role="columnheader" className="h-11" />
        </div>

        {/* Opening balance row (account-ledger mode only) */}
        {accountLedgerMode && openingBalance != null && (
          <div
            role="row"
            className={cn("grid min-h-[50px] items-center border-b border-border bg-accent-soft/40", grid)}
            data-testid="opening-balance-row"
          >
            <div className="px-4 py-2.5 text-[12.5px] tabular-nums text-faint">
              {lines[0] ? formatDate(lines[0].voucherDate) : ""}
            </div>
            <div className="px-4 py-2.5" />
            <div className="flex items-center gap-2 px-4 py-2.5">
              <span className="text-[13px] font-semibold text-foreground">Opening balance</span>
              <span className="text-[11.5px] text-faint">carried forward</span>
            </div>
            <div className="px-4 py-2.5" />
            <div className="px-4 py-2.5 text-right text-[13px] text-border-strong">—</div>
            <div className="px-4 py-2.5 text-right text-[13px] text-border-strong">—</div>
            <div
              className="px-4 py-2.5 text-right font-mono text-[13px] font-bold tabular-nums text-foreground"
              aria-label={`Opening balance ${formatMoney(openingBalance)}`}
            >
              {formatMoney(openingBalance)}
            </div>
            <div aria-hidden />
          </div>
        )}

        {lines.map((line) => {
          const src = sourceHref(line.sourceType, line.sourceId);
          const chips = dimensionChips(line, names);
          return (
            <div
              key={line.lineId}
              role="row"
              tabIndex={0}
              onClick={() => router.push(entryHref(line.entryId))}
              onKeyDown={(ev) => {
                if (ev.key === "Enter") {
                  ev.preventDefault();
                  router.push(entryHref(line.entryId));
                }
              }}
              className={cn(
                "grid min-h-[56px] cursor-pointer items-center border-b border-border outline-none",
                "focus:bg-accent-soft hover:bg-surface-2",
                grid,
              )}
              data-testid={`ledger-row-${line.lineId}`}
            >
              {/* date */}
              <div className="px-4 py-2.5 text-[13px] tabular-nums text-muted-foreground">
                {formatDate(line.voucherDate)}
              </div>
              {/* entry no + type + reversal badge */}
              <div className="min-w-0 px-4 py-2.5">
                <Link
                  href={entryHref(line.entryId)}
                  onClick={(ev) => ev.stopPropagation()}
                  className="block truncate font-mono text-[12.5px] font-semibold text-accent-ink hover:underline"
                >
                  {line.entryNo}
                </Link>
                <span className="mt-0.5 flex items-center gap-1.5">
                  <span className="text-[11.5px] text-faint">{voucherTypeLabel(line.voucherType)}</span>
                  {line.isReversal && (
                    <Badge tone="info" dot data-testid={`reversal-badge-${line.lineId}`}>
                      Reversal
                    </Badge>
                  )}
                </span>
              </div>
              {/* narration + dimension chips */}
              <div className="min-w-0 px-4 py-2.5">
                <div className="truncate text-[13px] text-foreground" title={line.narration ?? undefined}>
                  {line.narration || <span className="text-faint">—</span>}
                </div>
                {chips.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {chips.map((c) => (
                      <span
                        key={c.k}
                        className="inline-flex items-center gap-1 rounded-sm bg-accent-soft px-1.5 py-0.5"
                      >
                        <span className="font-mono text-[8.5px] font-semibold uppercase tracking-[0.3px] text-accent-ink">
                          {c.k}
                        </span>
                        <span className="max-w-[80px] truncate text-[11px] font-medium text-accent-ink">
                          {c.v}
                        </span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
              {/* party */}
              <div className="min-w-0 px-4 py-2.5">
                {line.partyId ? (
                  <span
                    className="block truncate text-[12.5px] text-foreground"
                    title={names.party(line.partyId)}
                  >
                    {names.party(line.partyId)}
                  </span>
                ) : (
                  <span className="text-[12.5px] text-faint">—</span>
                )}
              </div>
              {/* debit */}
              <div className="px-4 py-2.5 text-right">
                <Money value={line.debit} label="Debit" />
              </div>
              {/* credit */}
              <div className="px-4 py-2.5 text-right">
                <Money value={line.credit} label="Credit" />
              </div>
              {/* running balance (account-ledger mode only) */}
              {accountLedgerMode && (
                <div
                  className="px-4 py-2.5 text-right font-mono text-[13px] font-bold tabular-nums text-foreground"
                  aria-label={
                    line.runningBalance != null
                      ? `Running balance ${formatMoney(line.runningBalance)}`
                      : undefined
                  }
                >
                  {line.runningBalance != null ? formatMoney(line.runningBalance) : "—"}
                </div>
              )}
              {/* kebab: open entry / source voucher / correction note */}
              <div className="flex items-center justify-center px-2 py-2.5" onClick={(e) => e.stopPropagation()}>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    aria-label={`Actions for ${line.entryNo}`}
                    className="grid h-7 w-7 place-items-center rounded-token text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    data-testid={`ledger-actions-${line.lineId}`}
                  >
                    <MoreHorizontal className="h-4 w-4" aria-hidden />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-[240px]">
                    <DropdownMenuItem onSelect={() => router.push(entryHref(line.entryId))}>
                      <ArrowUpRight className="mr-2 h-4 w-4 text-muted-foreground" aria-hidden />
                      Open entry
                    </DropdownMenuItem>
                    {src && (
                      <DropdownMenuItem onSelect={() => router.push(src)}>
                        <FileText className="mr-2 h-4 w-4 text-muted-foreground" aria-hidden />
                        Go to source voucher
                      </DropdownMenuItem>
                    )}
                    <div className="my-1 h-px bg-border" />
                    <div className="flex items-start gap-2 px-2.5 py-2">
                      <Info className="mt-0.5 h-4 w-4 flex-none text-faint" aria-hidden />
                      <span className="text-[11.5px] leading-snug text-faint">
                        To correct, reverse the source voucher.
                      </span>
                    </div>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          );
        })}
      </div>

      {/* Mobile read-only cards (≥360) — back-office, desktop/tablet primary (spec §4) */}
      <div className="flex flex-col gap-2.5 md:hidden" data-testid="ledger-mobile">
        {accountLedgerMode && openingBalance != null && (
          <div className="flex items-center justify-between rounded-card border border-border bg-accent-soft/30 px-3.5 py-2.5">
            <span className="text-[12.5px] font-semibold text-foreground">Opening balance</span>
            <span className="font-mono text-[12.5px] font-bold tabular-nums text-foreground">
              {formatMoney(openingBalance)}
            </span>
          </div>
        )}
        {lines.map((line) => (
          <Link
            key={line.lineId}
            href={entryHref(line.entryId)}
            className="block rounded-card border border-border bg-surface p-3.5 shadow-sm hover:bg-accent-soft/60"
            data-testid={`ledger-card-${line.lineId}`}
          >
            <div className="flex items-start gap-2">
              <div className="min-w-0">
                <div className="font-mono text-[13px] font-semibold text-accent-ink">{line.entryNo}</div>
                <div className="mt-0.5 flex items-center gap-1.5">
                  <span className="text-[11.5px] text-faint">{formatDate(line.voucherDate)}</span>
                  {line.isReversal && (
                    <Badge tone="info" dot>
                      Reversal
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            <dl className="mt-2.5 flex flex-col gap-2 border-t border-muted pt-2.5">
              <MobileRow label="Debit" value={formatMoney(line.debit)} />
              <MobileRow label="Credit" value={formatMoney(line.credit)} />
              {accountLedgerMode && line.runningBalance != null && (
                <MobileRow label="Balance" value={formatMoney(line.runningBalance)} accent />
              )}
            </dl>
          </Link>
        ))}
      </div>
    </>
  );
}

function Money({ value, label }: { value: string; label: string }) {
  const isZero = value === "0" || Number(value) === 0;
  // A zero debit/credit renders as a faint em-dash (Account Ledger.dc.html), since
  // each posting line carries an amount on only ONE side.
  if (isZero) {
    return (
      <span className="text-[13px] text-border-strong" aria-label={`${label} nil`}>
        —
      </span>
    );
  }
  return (
    <span
      className="font-mono text-[13px] font-semibold tabular-nums text-foreground"
      aria-label={`${label} ${formatMoney(value)}`}
    >
      {formatMoney(value, { withSymbol: false })}
    </span>
  );
}

/** Two-caret sort affordance (Account Ledger.dc.html header). "active" = the sorted
 * column (top caret dark); "idle" = sortable but not active (both carets faint). */
function SortCarets({ state }: { state: "active" | "idle" }) {
  return (
    <span className="ml-1 flex flex-col text-[8px] leading-[0.6]" aria-hidden>
      <span className={state === "active" ? "text-foreground" : "text-border-strong"}>▲</span>
      <span className="text-border-strong">▼</span>
    </span>
  );
}

function HeaderCell({
  children,
  align,
  sort,
}: {
  children: React.ReactNode;
  align?: "right";
  sort?: "active" | "idle";
}) {
  return (
    <div
      role="columnheader"
      className={cn(
        "flex h-11 items-center px-4 text-[11px] font-semibold uppercase tracking-[0.4px]",
        sort === "active" ? "text-foreground" : "text-muted-foreground",
        align === "right" && "justify-end",
      )}
    >
      {children}
      {sort && <SortCarets state={sort} />}
    </div>
  );
}

function MobileRow({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2.5">
      <dt className="text-[11px] font-semibold uppercase tracking-[0.4px] text-faint">{label}</dt>
      <dd
        className={cn(
          "text-right font-mono text-[12.5px] tabular-nums",
          accent ? "font-bold text-foreground" : "text-muted-foreground",
        )}
      >
        {value}
      </dd>
    </div>
  );
}
