"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MoreVertical } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { money, moneyWithSymbol } from "../format";
import { BillStatusBadge } from "./BillStatusBadge";
import {
  type ProjectOption,
  type PurchaseBillSummary,
  type SupplierOption,
} from "../types";

export interface BillNameMaps {
  projects: Map<string, ProjectOption>;
  suppliers: Map<string, SupplierOption>;
}

const GRID =
  "146px 1.35fr 1.1fr 96px 120px 108px 110px 132px 128px 116px 46px";

export type BillSortKey =
  | "entryNo"
  | "billDate"
  | "grossAmount"
  | "vatInputAmount"
  | "tdsAit"
  | "netPayableAmount"
  | "outstandingAmount";
export type SortDirection = "asc" | "desc";
export interface BillSortState {
  key: BillSortKey;
  direction: SortDirection;
}

/**
 * Clickable sort-caret header (design "Purchase Bill.dc.html" table). Sorting is client-side
 * over the current page of rows only — `GET /purchase/bills` has no sort param (contract 08
 * §111, always `billDate desc` server-side), so it can't reorder across pages. Cycle:
 * asc → desc → unsorted. Same convention as the PO / receipts lists.
 */
function SortHead({
  label,
  sortKey,
  sort,
  onSort,
  align = "left",
}: {
  label: string;
  sortKey: BillSortKey;
  sort: BillSortState | null;
  onSort: (key: BillSortKey) => void;
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
      data-testid={`bill-sort-${sortKey}`}
      className={cn(
        "flex w-full items-center gap-1.5",
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

function billValue(r: PurchaseBillSummary, key: BillSortKey): string | number {
  switch (key) {
    case "entryNo":
      // Drafts (entryNo null) sort last in asc.
      return r.entryNo ?? "￿";
    case "billDate":
      return r.billDate;
    case "grossAmount":
      return Number(r.grossAmount);
    case "vatInputAmount":
      return Number(r.vatInputAmount);
    case "tdsAit":
      return Number(r.tdsAmount) + Number(r.aitAmount);
    case "netPayableAmount":
      return Number(r.netPayableAmount);
    case "outstandingAmount":
      return Number(r.outstandingAmount);
  }
}

function compareRows(a: PurchaseBillSummary, b: PurchaseBillSummary, key: BillSortKey): number {
  const av = billValue(a, key);
  const bv = billValue(b, key);
  if (typeof av === "number" && typeof bv === "number") return av - bv;
  return String(av).localeCompare(String(bv));
}

export function sortRows(
  rows: PurchaseBillSummary[],
  sort: BillSortState | null,
): PurchaseBillSummary[] {
  if (!sort) return rows;
  const sorted = [...rows].sort((a, b) => compareRows(a, b, sort.key));
  return sort.direction === "asc" ? sorted : sorted.reverse();
}

function projectName(maps: BillNameMaps, id: string): string {
  const p = maps.projects.get(id);
  if (!p) return "(name unavailable)";
  return p.projectCode ? `${p.projectCode} — ${p.name}` : p.name;
}
function supplierName(maps: BillNameMaps, id: string): string {
  return maps.suppliers.get(id)?.name ?? "(name unavailable)";
}

/**
 * Purchase Bill list (brief §Scope 3; spec §4/§5). Full grid at ≥lg: Entry no · Supplier
 * · Project · Bill date · Gross · VAT input · TDS/AIT · Net payable · Outstanding · Status
 * · row action. A DRAFT row shows a "Draft" badge in place of the entry no; money is
 * right-aligned + tabular; row click routes DRAFT → editor, POSTED/CANCELLED → viewer.
 * Below lg: stacked bill cards (site-facing back-office is not the primary use).
 */
export function BillList({
  rows,
  maps,
  basePath = "/purchase/bills",
}: {
  rows: PurchaseBillSummary[];
  maps: BillNameMaps;
  basePath?: string;
}) {
  const router = useRouter();
  const [sort, setSort] = useState<BillSortState | null>(null);

  function handleSort(key: BillSortKey) {
    setSort((prev) => {
      if (prev?.key !== key) return { key, direction: "asc" };
      if (prev.direction === "asc") return { key, direction: "desc" };
      return null;
    });
  }

  const sortedRows = useMemo(() => sortRows(rows, sort), [rows, sort]);

  return (
    <div data-testid="bill-list">
      {/* ≥lg data-grid */}
      <div className="hidden overflow-x-auto lg:block">
        <div style={{ minWidth: 1360 }}>
          <div
            role="row"
            className="grid items-center border-b border-border-strong bg-surface-2 text-[11px] font-semibold uppercase tracking-[0.4px] text-muted-foreground"
            style={{ gridTemplateColumns: GRID }}
          >
            <div className="flex h-11 items-center px-3.5">
              <SortHead label="Entry no" sortKey="entryNo" sort={sort} onSort={handleSort} />
            </div>
            <div className="flex h-11 items-center px-3">Supplier</div>
            <div className="flex h-11 items-center px-3">Project</div>
            <div className="flex h-11 items-center px-3">
              <SortHead label="Bill date" sortKey="billDate" sort={sort} onSort={handleSort} />
            </div>
            <div className="flex h-11 items-center justify-end px-3">
              <SortHead label="Gross ৳" sortKey="grossAmount" sort={sort} onSort={handleSort} align="right" />
            </div>
            <div className="flex h-11 items-center justify-end px-3">
              <SortHead label="VAT input ৳" sortKey="vatInputAmount" sort={sort} onSort={handleSort} align="right" />
            </div>
            <div className="flex h-11 items-center justify-end px-3">
              <SortHead label="TDS / AIT ৳" sortKey="tdsAit" sort={sort} onSort={handleSort} align="right" />
            </div>
            <div className="flex h-11 items-center justify-end px-3">
              <SortHead label="Net payable ৳" sortKey="netPayableAmount" sort={sort} onSort={handleSort} align="right" />
            </div>
            <div className="flex h-11 items-center justify-end px-3">
              <SortHead label="Outstanding ৳" sortKey="outstandingAmount" sort={sort} onSort={handleSort} align="right" />
            </div>
            <div className="flex h-11 items-center px-3">Status</div>
            <div className="h-11" />
          </div>
          {sortedRows.map((r) => {
            const tdsAndAit = Number(r.tdsAmount) + Number(r.aitAmount);
            return (
              <div
                key={r.id}
                role="row"
                data-testid={`bill-row-${r.status}`}
                className="grid min-h-[54px] cursor-pointer items-center border-b border-border last:border-b-0 hover:bg-surface-2"
                style={{ gridTemplateColumns: GRID }}
                onClick={() => router.push(`${basePath}/${r.id}`)}
              >
                <div className="min-w-0 px-3.5 py-2.5">
                  {r.entryNo ? (
                    <Link
                      href={`${basePath}/${r.id}`}
                      className="font-semibold text-accent-ink hover:underline"
                      data-testid="bill-open"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {r.entryNo}
                    </Link>
                  ) : (
                    <Badge tone="warning" dot data-testid="bill-open">
                      Draft
                    </Badge>
                  )}
                </div>
                <div className="min-w-0 px-3 py-2.5 text-[13px] [overflow-wrap:anywhere]">
                  {supplierName(maps, r.supplierId)}
                </div>
                <div className="min-w-0 px-3 py-2.5 text-[13px] [overflow-wrap:anywhere]">
                  {projectName(maps, r.projectId)}
                </div>
                <div className="px-3 py-2.5 text-[12.5px] tabular-nums text-muted-foreground">
                  {formatDate(r.billDate)}
                </div>
                <div className="px-3 py-2.5 text-right font-mono text-[12.5px] tabular-nums text-foreground">
                  {money(r.grossAmount)}
                </div>
                <div className="px-3 py-2.5 text-right font-mono text-[12.5px] tabular-nums text-muted-foreground">
                  {money(r.vatInputAmount)}
                </div>
                <div className="px-3 py-2.5 text-right font-mono text-[12.5px] tabular-nums text-muted-foreground">
                  {money(tdsAndAit.toFixed(4))}
                </div>
                <div className="px-3 py-2.5 text-right font-mono text-[13px] font-semibold tabular-nums text-foreground">
                  {money(r.netPayableAmount)}
                </div>
                <div className="px-3 py-2.5 text-right font-mono text-[12.5px] tabular-nums text-foreground">
                  {money(r.outstandingAmount)}
                </div>
                <div className="px-3 py-2.5">
                  <BillStatusBadge status={r.status} />
                </div>
                <div className="flex justify-end px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                  <BillRowActions id={r.id} basePath={basePath} label={r.entryNo ?? "draft bill"} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* <lg stacked cards (back-office reference only) */}
      <div className="flex flex-col lg:hidden">
        {sortedRows.map((r) => (
          <Link
            key={r.id}
            href={`${basePath}/${r.id}`}
            data-testid={`bill-card-${r.status}`}
            className="border-b border-border last:border-b-0 px-4 py-3 hover:bg-surface-2"
          >
            <div className="flex items-start justify-between gap-2">
              {r.entryNo ? (
                <span className="font-semibold text-accent-ink">{r.entryNo}</span>
              ) : (
                <Badge tone="warning" dot>
                  Draft
                </Badge>
              )}
              <BillStatusBadge status={r.status} />
            </div>
            <div className="mt-1 text-[13px] font-semibold text-foreground [overflow-wrap:anywhere]">
              {supplierName(maps, r.supplierId)}
            </div>
            <div className="mt-0.5 text-[12.5px] text-muted-foreground [overflow-wrap:anywhere]">
              {projectName(maps, r.projectId)}
            </div>
            <div className="mt-2 flex flex-col gap-1 border-t border-border pt-2 text-[12.5px]">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Net payable</span>
                <span className="font-mono font-semibold tabular-nums text-foreground">
                  {moneyWithSymbol(r.netPayableAmount)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-warning-ink">Outstanding</span>
                <span className="font-mono font-semibold tabular-nums text-warning-ink">
                  {Number(r.outstandingAmount) > 0 ? moneyWithSymbol(r.outstandingAmount) : "—"}
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

/** Row-action kebab (design-system table pattern). Vertical ⋯; opens/views the bill. */
function BillRowActions({ id, basePath, label }: { id: string; basePath: string; label: string }) {
  const router = useRouter();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Actions for ${label}`}
        data-testid="bill-row-actions"
        className="grid h-7 w-7 place-items-center rounded-token text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <MoreVertical className="h-4 w-4" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onSelect={() => router.push(`${basePath}/${id}`)} data-testid="bill-row-open">
          Open
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
