"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, MoreVertical } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/format";
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
  "minmax(140px,1.2fr) minmax(150px,1.4fr) minmax(150px,1.4fr) 110px 120px 120px 120px 120px 120px 110px 40px";

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

  return (
    <div data-testid="bill-list">
      {/* ≥lg data-grid */}
      <div className="hidden overflow-x-auto lg:block">
        <div style={{ minWidth: 1360 }}>
          <div
            role="row"
            className="grid items-center gap-2 border-b border-border-strong bg-surface-2 px-4 text-[11px] font-semibold uppercase tracking-[0.4px] text-muted-foreground"
            style={{ gridTemplateColumns: GRID }}
          >
            <div className="py-3">Entry no</div>
            <div className="py-3">Supplier</div>
            <div className="py-3">Project</div>
            <div className="flex items-center gap-1 py-3">
              Bill date
              <ChevronDown className="h-3 w-3 text-foreground" aria-hidden />
            </div>
            <div className="py-3 text-right">Gross</div>
            <div className="py-3 text-right">VAT input</div>
            <div className="py-3 text-right">TDS / AIT</div>
            <div className="py-3 text-right">Net payable</div>
            <div className="py-3 text-right">Outstanding</div>
            <div className="py-3">Status</div>
            <div className="py-3" />
          </div>
          {rows.map((r) => {
            const tdsAndAit = Number(r.tdsAmount) + Number(r.aitAmount);
            return (
              <div
                key={r.id}
                role="row"
                data-testid={`bill-row-${r.status}`}
                className="grid cursor-pointer items-center gap-2 border-b border-muted px-4 hover:bg-surface-2"
                style={{ gridTemplateColumns: GRID }}
                onClick={() => router.push(`${basePath}/${r.id}`)}
              >
                <div className="min-w-0 py-3">
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
                <div className="min-w-0 py-3 text-[13px] [overflow-wrap:anywhere]">
                  {supplierName(maps, r.supplierId)}
                </div>
                <div className="min-w-0 py-3 text-[13px] [overflow-wrap:anywhere]">
                  {projectName(maps, r.projectId)}
                </div>
                <div className="py-3 text-[12.5px] tabular-nums text-muted-foreground">
                  {formatDate(r.billDate)}
                </div>
                <div className="py-3 text-right font-mono text-[12.5px] tabular-nums text-foreground">
                  {money(r.grossAmount)}
                </div>
                <div className="py-3 text-right font-mono text-[12.5px] tabular-nums text-foreground">
                  {money(r.vatInputAmount)}
                </div>
                <div className="py-3 text-right font-mono text-[12.5px] tabular-nums text-foreground">
                  {money(tdsAndAit.toFixed(4))}
                </div>
                <div className="py-3 text-right font-mono text-[13px] font-semibold tabular-nums text-foreground">
                  {money(r.netPayableAmount)}
                </div>
                <div className="py-3 text-right font-mono text-[12.5px] tabular-nums text-foreground">
                  {money(r.outstandingAmount)}
                </div>
                <div className="py-3">
                  <BillStatusBadge status={r.status} />
                </div>
                <div className="flex justify-end py-3" onClick={(e) => e.stopPropagation()}>
                  <BillRowActions id={r.id} basePath={basePath} label={r.entryNo ?? "draft bill"} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* <lg stacked cards (back-office reference only) */}
      <div className="flex flex-col lg:hidden">
        {rows.map((r) => (
          <Link
            key={r.id}
            href={`${basePath}/${r.id}`}
            data-testid={`bill-card-${r.status}`}
            className="border-b border-muted px-4 py-3 hover:bg-surface-2"
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
            <div className="mt-2 flex flex-col gap-1 border-t border-muted pt-2 text-[12.5px]">
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
