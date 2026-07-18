"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronRight, Copy, Printer } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatDate } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import { isReceiptDraft } from "../api/receipt";
import { type CustomerOption, type ProjectOption, type ReceiptSummary } from "../types";
import { ReceiptStatusBadge } from "./ReceiptStatusBadge";
import { ReceiptTypeBadge } from "./ReceiptTypeBadge";
import { PaymentModeTag, paymentModeLabel } from "./PaymentModeTag";

export interface ReceiptNameMaps {
  customers: Map<string, CustomerOption>;
  projects: Map<string, ProjectOption>;
  ipcs: Map<string, string | null>; // ipcId -> entryNo (or null while unresolved)
}

function customerName(maps: ReceiptNameMaps, id: string): string {
  return maps.customers.get(id)?.name ?? `${id.slice(0, 8)}… (name unavailable)`;
}
function ipcLabel(maps: ReceiptNameMaps, id: string | null): string {
  if (!id) return "—";
  const entryNo = maps.ipcs.get(id);
  if (entryNo) return entryNo;
  return `${id.slice(0, 8)}… (unavailable)`;
}

function targetRoute(r: ReceiptSummary): string {
  return isReceiptDraft(r.status) ? `/receipts/${r.id}` : `/receipts/${r.id}/view`;
}

const GRID = "112px 92px 106px 80px minmax(108px,1.1fr) 84px 132px 122px minmax(168px,auto)";
const TABLET_GRID = "minmax(140px,1.3fr) minmax(120px,1fr) minmax(160px,1.6fr) 120px 100px 36px";

export type ReceiptSortKey = "entryNo" | "receiptDate" | "amountSettled" | "taxDeductedAtSource";
export type SortDirection = "asc" | "desc";
export interface ReceiptSortState {
  key: ReceiptSortKey;
  direction: SortDirection;
}

/**
 * Clickable sort-caret header (design-files/CLAUDE.md table pattern: "every sortable
 * column shows small up/down sort carets"). Sorting is client-side over the current
 * page of rows only — the list has no backend sort param (contract 11-receipts has
 * none), so it can't reorder across pages.
 */
function SortHead({
  label,
  sortKey,
  sort,
  onSort,
  align = "left",
}: {
  label: string;
  sortKey: ReceiptSortKey;
  sort: ReceiptSortState | null;
  onSort: (key: ReceiptSortKey) => void;
  align?: "left" | "right";
}) {
  const active = sort?.key === sortKey;
  const sortedState = active
    ? sort.direction === "asc"
      ? "sorted ascending"
      : "sorted descending"
    : "not sorted";
  return (
    <button
      type="button"
      onClick={() => onSort(sortKey)}
      aria-label={`${label}, ${sortedState}. Click to sort.`}
      data-testid={`receipt-sort-${sortKey}`}
      className={cn(
        "flex w-full items-center gap-1 py-3 text-left",
        align === "right" && "justify-end",
      )}
    >
      <span className="whitespace-nowrap">{label}</span>
      <span className="flex shrink-0 flex-col text-[8px] leading-[0.6]" aria-hidden>
        <span className={active && sort.direction === "asc" ? "text-foreground" : "text-border-strong"}>
          ▲
        </span>
        <span className={active && sort.direction === "desc" ? "text-foreground" : "text-border-strong"}>
          ▼
        </span>
      </span>
    </button>
  );
}

function compareRows(a: ReceiptSummary, b: ReceiptSummary, key: ReceiptSortKey): number {
  switch (key) {
    case "entryNo":
      return (a.entryNo ?? "").localeCompare(b.entryNo ?? "");
    case "receiptDate":
      return a.receiptDate.localeCompare(b.receiptDate);
    case "amountSettled":
      return Number(a.amountSettled) - Number(b.amountSettled);
    case "taxDeductedAtSource":
      return Number(a.taxDeductedAtSource) - Number(b.taxDeductedAtSource);
  }
}

export function sortRows(
  rows: ReceiptSummary[],
  sort: ReceiptSortState | null,
): ReceiptSummary[] {
  if (!sort) return rows;
  const sorted = [...rows].sort((a, b) => compareRows(a, b, sort.key));
  return sort.direction === "asc" ? sorted : sorted.reverse();
}

/**
 * Receipt list (brief §Scope 3/8; spec §4/§5). Three tiers: full grid ≥1024, a
 * column-collapse tablet grid ≥768 (Tax-at-source + IPC behind a per-row expander),
 * and read-only stacked cards <768 (back-office register, not optimised for phone —
 * spec §4). Row click routes DRAFT → the editor (`/receipts/{id}`), POSTED/CANCELLED
 * → the viewer (`/receipts/{id}/view`); "Print" (posted rows only, FR-REC-025) routes
 * to the viewer, which owns the print action.
 */
export function ReceiptList({
  rows,
  maps,
  canPrint,
}: {
  rows: ReceiptSummary[];
  maps: ReceiptNameMaps;
  canPrint: boolean;
}) {
  const router = useRouter();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [sort, setSort] = useState<ReceiptSortState | null>(null);

  function toggleExpanded(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleSort(key: ReceiptSortKey) {
    setSort((prev) => {
      if (prev?.key !== key) return { key, direction: "asc" };
      if (prev.direction === "asc") return { key, direction: "desc" };
      return null;
    });
  }

  const sortedRows = useMemo(() => sortRows(rows, sort), [rows, sort]);

  return (
    <div data-testid="receipt-list">
      {/* ≥lg full data-grid */}
      <div className="hidden overflow-x-auto lg:block">
        <div style={{ minWidth: 960 }}>
          <div
            role="row"
            className="grid items-center gap-2 border-b border-border-strong bg-surface-2 px-4 text-[11px] font-semibold uppercase tracking-[0.4px] text-muted-foreground"
            style={{ gridTemplateColumns: GRID }}
          >
            <SortHead label="Number" sortKey="entryNo" sort={sort} onSort={handleSort} />
            <SortHead label="Date" sortKey="receiptDate" sort={sort} onSort={handleSort} />
            <div className="py-3">Type</div>
            <div className="py-3">Mode</div>
            <div className="py-3">Party</div>
            <div className="py-3">IPC</div>
            <SortHead
              label="Amount settled ৳"
              sortKey="amountSettled"
              sort={sort}
              onSort={handleSort}
              align="right"
            />
            <SortHead
              label="Tax at source ৳"
              sortKey="taxDeductedAtSource"
              sort={sort}
              onSort={handleSort}
              align="right"
            />
            <div className="py-3">Status</div>
          </div>
          {sortedRows.map((r) => {
            const draft = isReceiptDraft(r.status);
            const href = targetRoute(r);
            return (
              <div
                key={r.id}
                role="row"
                data-testid={`receipt-row-${r.status}`}
                className="grid cursor-pointer items-center gap-2 border-b border-muted px-4 hover:bg-surface-2"
                style={{ gridTemplateColumns: GRID }}
                onClick={() => router.push(href)}
              >
                <div className="min-w-0 py-3">
                  {draft ? (
                    <Link
                      href={href}
                      className="inline-flex items-center gap-1.5 rounded-pill bg-warning-soft px-2.5 py-0.5 text-xs font-semibold text-warning-ink"
                      data-testid="receipt-open"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-warning" aria-hidden />
                      Draft
                    </Link>
                  ) : (
                    <Link
                      href={href}
                      className="font-semibold text-accent-ink hover:underline"
                      data-testid="receipt-open"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {r.entryNo}
                    </Link>
                  )}
                </div>
                <div className="py-3 text-[12.5px] tabular-nums text-muted-foreground">
                  {formatDate(r.receiptDate)}
                </div>
                <div className="whitespace-nowrap py-3">
                  <ReceiptTypeBadge type={r.receiptType} />
                </div>
                <div className="min-w-0 truncate py-3" title={paymentModeLabel(r.paymentMode)}>
                  <PaymentModeTag mode={r.paymentMode} />
                </div>
                <div
                  className="min-w-0 truncate py-3 text-[13px]"
                  title={customerName(maps, r.partyId)}
                >
                  {customerName(maps, r.partyId)}
                </div>
                <div
                  className="min-w-0 truncate py-3 text-[12.5px] text-muted-foreground"
                  title={ipcLabel(maps, r.ipcId)}
                >
                  {ipcLabel(maps, r.ipcId)}
                </div>
                <div
                  className="py-3 text-right font-mono text-[13px] font-semibold tabular-nums text-foreground"
                  aria-label={`Amount settled ৳ ${formatMoney(r.amountSettled, { withSymbol: false })}`}
                >
                  {formatMoney(r.amountSettled, { withSymbol: false })}
                </div>
                <div
                  className="py-3 text-right font-mono text-[12.5px] tabular-nums text-muted-foreground"
                  aria-label={`Tax deducted at source ৳ ${formatMoney(r.taxDeductedAtSource, { withSymbol: false })}`}
                >
                  {formatMoney(r.taxDeductedAtSource, { withSymbol: false })}
                </div>
                <div
                  className="flex items-center gap-1.5 py-3"
                  onClick={(e) => e.stopPropagation()}
                >
                  <ReceiptStatusBadge status={r.status} />
                  <Link
                    href={href}
                    className="text-[12.5px] font-semibold text-accent-ink hover:underline"
                    data-testid={draft ? "receipt-edit" : "receipt-view"}
                  >
                    {draft ? "Edit" : "View"}
                  </Link>
                  {canPrint && r.status === "POSTED" && (
                    <Link
                      href={href}
                      aria-label="Print receipt"
                      data-testid="receipt-print"
                      className="grid h-7 w-7 place-items-center rounded-token text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      <Printer className="h-4 w-4" aria-hidden />
                    </Link>
                  )}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        aria-label="More actions"
                        data-testid="receipt-kebab"
                        className="grid h-7 w-7 place-items-center rounded-token text-muted-foreground hover:bg-muted hover:text-foreground"
                      >
                        <span aria-hidden>⋯</span>
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      {r.entryNo && (
                        <DropdownMenuItem
                          onSelect={() => void navigator.clipboard?.writeText(r.entryNo ?? "")}
                          data-testid="receipt-copy-number"
                        >
                          <Copy className="mr-2 h-3.5 w-3.5" aria-hidden />
                          Copy receipt number
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem asChild>
                        <Link href={href}>{draft ? "Edit" : "View"}</Link>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ≥md, <lg — tablet: Tax-at-source + IPC behind a per-row expander */}
      <div className="hidden overflow-x-auto md:block lg:hidden">
        <div style={{ minWidth: 660 }}>
          <div
            role="row"
            className="grid items-center gap-2 border-b border-border-strong bg-surface-2 px-4 text-[11px] font-semibold uppercase tracking-[0.4px] text-muted-foreground"
            style={{ gridTemplateColumns: TABLET_GRID }}
          >
            <div className="py-3">Number</div>
            <div className="py-3">Type</div>
            <div className="py-3">Party</div>
            <div className="py-3 text-right">Amount ৳</div>
            <div className="py-3">Status</div>
            <div className="py-3" />
          </div>
          {sortedRows.map((r) => {
            const draft = isReceiptDraft(r.status);
            const href = targetRoute(r);
            const isOpen = expanded.has(r.id);
            return (
              <div key={r.id}>
                <div
                  role="row"
                  data-testid={`receipt-tablet-row-${r.status}`}
                  className="grid items-center gap-2 border-b border-muted px-4"
                  style={{ gridTemplateColumns: TABLET_GRID }}
                >
                  <div className="min-w-0 py-3">
                    {draft ? (
                      <span className="inline-flex items-center gap-1.5 rounded-pill bg-warning-soft px-2.5 py-0.5 text-xs font-semibold text-warning-ink">
                        <span className="h-1.5 w-1.5 rounded-full bg-warning" aria-hidden />
                        Draft
                      </span>
                    ) : (
                      <Link href={href} className="font-semibold text-accent-ink hover:underline">
                        {r.entryNo}
                      </Link>
                    )}
                    <div className="mt-0.5 text-[11.5px] text-muted-foreground">
                      {formatDate(r.receiptDate)}
                    </div>
                  </div>
                  <div className="min-w-0 py-3">
                    <ReceiptTypeBadge type={r.receiptType} />
                    <div className="mt-0.5">
                      <PaymentModeTag
                        mode={r.paymentMode}
                        className="text-[11.5px] text-muted-foreground inline-flex items-center gap-1"
                      />
                    </div>
                  </div>
                  <div
                    className="min-w-0 truncate py-3 text-[13px]"
                    title={customerName(maps, r.partyId)}
                  >
                    {customerName(maps, r.partyId)}
                  </div>
                  <div className="py-3 text-right font-mono text-[13px] font-semibold tabular-nums text-foreground">
                    {formatMoney(r.amountSettled, { withSymbol: false })}
                  </div>
                  <div className="py-3">
                    <ReceiptStatusBadge status={r.status} />
                  </div>
                  <div className="flex justify-end py-3">
                    <button
                      type="button"
                      aria-expanded={isOpen}
                      aria-controls={`receipt-expand-${r.id}`}
                      aria-label={isOpen ? "Collapse row details" : "Expand row details"}
                      onClick={() => toggleExpanded(r.id)}
                      data-testid={`receipt-expander-${r.id}`}
                      className="grid h-7 w-7 place-items-center rounded-token text-muted-foreground hover:bg-muted"
                    >
                      {isOpen ? (
                        <ChevronDown className="h-4 w-4" aria-hidden />
                      ) : (
                        <ChevronRight className="h-4 w-4" aria-hidden />
                      )}
                    </button>
                  </div>
                </div>
                {isOpen && (
                  <div
                    id={`receipt-expand-${r.id}`}
                    className="grid grid-cols-2 gap-3 border-b border-muted bg-surface-2 px-4 py-3 text-[12.5px]"
                    data-testid={`receipt-expanded-${r.id}`}
                  >
                    <div>
                      <div className="text-[10.5px] uppercase tracking-[0.4px] text-faint">
                        Tax at source
                      </div>
                      <div className="font-mono tabular-nums text-foreground">
                        {formatMoney(r.taxDeductedAtSource, { withSymbol: false })}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10.5px] uppercase tracking-[0.4px] text-faint">IPC</div>
                      <div className="text-foreground">{ipcLabel(maps, r.ipcId)}</div>
                    </div>
                    <div className="col-span-2">
                      <Link href={href} className="font-semibold text-accent-ink hover:underline">
                        {draft ? "Edit" : "View"}
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* <md — read-only stacked cards (spec §4: back-office register, not phone-optimised) */}
      <div className="flex flex-col gap-3 p-4 md:hidden">
        {sortedRows.map((r) => {
          const draft = isReceiptDraft(r.status);
          const href = targetRoute(r);
          return (
            <Link
              key={r.id}
              href={href}
              data-testid={`receipt-card-${r.status}`}
              className="block rounded-card border border-border bg-surface shadow-sm hover:bg-surface-2"
            >
              <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
                <span className="font-semibold text-accent-ink">{draft ? "Draft" : r.entryNo}</span>
                <ReceiptStatusBadge status={r.status} />
              </div>
              <div className="grid gap-1.5 px-4 py-3 text-[12.5px]">
                <MobileRow label="Date" value={formatDate(r.receiptDate)} />
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">Type</span>
                  <span className="flex items-center gap-1.5">
                    <ReceiptTypeBadge type={r.receiptType} /> · {paymentModeLabel(r.paymentMode)}
                  </span>
                </div>
                <MobileRow label="Party" value={customerName(maps, r.partyId)} />
              </div>
              <div className="flex items-center justify-between border-t border-border px-4 py-3">
                <span className="text-muted-foreground">Amount settled</span>
                <span className="font-mono text-[14px] font-bold tabular-nums text-foreground">
                  {formatMoney(r.amountSettled)}
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function MobileRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("text-right text-foreground", "[overflow-wrap:anywhere]")}>{value}</span>
    </div>
  );
}
