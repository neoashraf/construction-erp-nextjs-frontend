"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import { EntryStatusBadge } from "./EntryStatusBadge";
import { type JournalEntryHeader, voucherTypeLabel, entryStatus } from "../types";

/**
 * Journal-entries table (spec §4/§5/§10; design file grid). READ-ONLY — rows open the
 * Entry viewer; there is NO create/edit/delete/void control. Columns: Entry no (→
 * viewer) + voucher-type sub-label · Date (DD/MM/YYYY) · Narration (Bangla-safe,
 * truncate-with-tooltip, never clipped) · Source (type + id → source voucher) ·
 * Debit ৳ / Credit ৳ (right-aligned tabular, Decimal(18,4) via formatMoney) · Status
 * badge. Keyboard: rows are focusable, Enter opens the entry; the Source link is
 * independently focusable (spec §10). Money carries an accessible label.
 */

const GRID = "grid-cols-[1.45fr_0.9fr_2fr_1.2fr_1fr_1fr_1fr_44px]";

function entryHref(id: string): string {
  return `/ledger/entry-viewer?id=${id}`;
}

function sourceHref(sourceType: string | null, sourceId: string | null): string | null {
  if (!sourceType || !sourceId) return null;
  // Best-effort route to the originating voucher; the voucher modules own the exact
  // path (Tier-2). Until they land this is a stable, guessable segment.
  return `/vouchers/${sourceType.toLowerCase()}/${sourceId}`;
}

export function EntriesTable({ entries }: { entries: JournalEntryHeader[] }) {
  const router = useRouter();

  return (
    <>
      {/* Desktop / tablet grid */}
      <div role="table" aria-label="Journal entries" className="hidden md:block" data-testid="entries-desktop">
        <div role="row" className={cn("sticky top-0 z-[2] grid border-b border-border-strong bg-surface-2", GRID)}>
          <HeaderCell>Entry no</HeaderCell>
          <HeaderCell>Date</HeaderCell>
          <HeaderCell>Narration</HeaderCell>
          <HeaderCell>Source</HeaderCell>
          <HeaderCell align="right">Debit ৳</HeaderCell>
          <HeaderCell align="right">Credit ৳</HeaderCell>
          <HeaderCell>Status</HeaderCell>
          <div role="columnheader" className="h-11" />
        </div>

        {entries.map((e) => {
          const status = entryStatus(e);
          const src = sourceHref(e.sourceType, e.sourceId);
          return (
            <div
              key={e.id}
              role="row"
              tabIndex={0}
              onClick={() => router.push(entryHref(e.id))}
              onKeyDown={(ev) => {
                if (ev.key === "Enter") {
                  ev.preventDefault();
                  router.push(entryHref(e.id));
                }
              }}
              className={cn(
                "grid cursor-pointer items-center border-b border-border outline-none",
                "focus:bg-accent-soft hover:bg-surface-2",
                GRID,
              )}
              data-testid={`entry-row-${e.entryNo}`}
            >
              {/* entry no → viewer */}
              <div className="min-w-0 px-4 py-2.5">
                <Link
                  href={entryHref(e.id)}
                  onClick={(ev) => ev.stopPropagation()}
                  className="font-mono text-[13px] font-semibold text-accent-ink hover:underline"
                >
                  {e.entryNo}
                </Link>
                <span className="block text-[11.5px] text-faint">{voucherTypeLabel(e.voucherType)}</span>
              </div>
              {/* date */}
              <div className="px-4 py-2.5 text-[13px] tabular-nums text-muted-foreground">
                {formatDate(e.voucherDate)}
              </div>
              {/* narration — Bangla-safe, truncate-with-tooltip, never clipped */}
              <div className="min-w-0 px-4 py-2.5">
                <div className="truncate text-[13px] text-foreground" title={e.narration ?? undefined}>
                  {e.narration || <span className="text-faint">—</span>}
                </div>
              </div>
              {/* source */}
              <div className="min-w-0 px-4 py-2.5">
                {e.sourceType ? (
                  <>
                    <span className="block text-[12.5px] text-foreground">{e.sourceType}</span>
                    {src ? (
                      <Link
                        href={src}
                        onClick={(ev) => ev.stopPropagation()}
                        className="font-mono text-[12px] text-muted-foreground hover:text-info hover:underline"
                      >
                        {e.sourceId}
                      </Link>
                    ) : (
                      <span className="font-mono text-[12px] text-faint">{e.sourceId}</span>
                    )}
                  </>
                ) : (
                  <span className="text-[12.5px] text-faint">—</span>
                )}
              </div>
              {/* debit */}
              <div className="px-4 py-2.5 text-right">
                <span
                  className="font-mono text-[13px] font-semibold tabular-nums text-foreground"
                  aria-label={`Total debit ${formatMoney(e.totalDebit)}`}
                >
                  {formatMoney(e.totalDebit, { withSymbol: false })}
                </span>
              </div>
              {/* credit */}
              <div className="px-4 py-2.5 text-right">
                <span
                  className="font-mono text-[13px] font-semibold tabular-nums text-foreground"
                  aria-label={`Total credit ${formatMoney(e.totalCredit)}`}
                >
                  {formatMoney(e.totalCredit, { withSymbol: false })}
                </span>
              </div>
              {/* status */}
              <div className="px-4 py-2.5">
                <EntryStatusBadge status={status} />
              </div>
              {/* trailing spacer (kebab column in the design; read-only → no actions) */}
              <div aria-hidden />
            </div>
          );
        })}
      </div>

      {/* Mobile read-only cards (≥360) — back-office, desktop/tablet primary (spec §4) */}
      <div className="flex flex-col gap-2.5 md:hidden" data-testid="entries-mobile">
        {entries.map((e) => {
          const status = entryStatus(e);
          return (
            <Link
              key={e.id}
              href={entryHref(e.id)}
              className="block rounded-card border border-border bg-surface p-3.5 shadow-sm hover:bg-surface-2"
              data-testid={`entry-card-${e.entryNo}`}
            >
              <div className="flex items-start gap-2">
                <div className="min-w-0">
                  <div className="font-mono text-[13.5px] font-semibold text-accent-ink">{e.entryNo}</div>
                  <div className="text-[11.5px] text-faint">{voucherTypeLabel(e.voucherType)}</div>
                </div>
                <span className="ml-auto flex-none">
                  <EntryStatusBadge status={status} />
                </span>
              </div>
              <dl className="mt-2.5 flex flex-col gap-2 border-t border-muted pt-2.5">
                <MobileRow label="Date" value={formatDate(e.voucherDate)} mono />
                <MobileRow
                  label="Total"
                  value={formatMoney(e.totalDebit)}
                  mono
                  accent
                />
              </dl>
            </Link>
          );
        })}
      </div>
    </>
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
  mono,
  accent,
}: {
  label: string;
  value: string;
  mono?: boolean;
  accent?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2.5">
      <dt className="text-[11px] font-semibold uppercase tracking-[0.4px] text-faint">{label}</dt>
      <dd
        className={cn(
          "text-right text-[12.5px]",
          mono && "font-mono tabular-nums",
          accent ? "font-semibold text-foreground" : "text-muted-foreground",
        )}
      >
        {value}
      </dd>
    </div>
  );
}
