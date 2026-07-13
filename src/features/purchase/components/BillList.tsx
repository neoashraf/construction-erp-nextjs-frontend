"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { formatDate } from "@/lib/format";
import { formatMoney } from "@/lib/money";
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
            <div className="py-3">Bill date</div>
            <div className="py-3 text-right">Gross ৳</div>
            <div className="py-3 text-right">VAT input ৳</div>
            <div className="py-3 text-right">TDS + AIT ৳</div>
            <div className="py-3 text-right">Net payable ৳</div>
            <div className="py-3 text-right">Outstanding ৳</div>
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
                  <Link
                    href={`${basePath}/${r.id}`}
                    className="font-semibold text-accent-ink hover:underline"
                    data-testid="bill-open"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {r.entryNo ?? "Draft"}
                  </Link>
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
                  {formatMoney(r.grossAmount, { withSymbol: false })}
                </div>
                <div className="py-3 text-right font-mono text-[12.5px] tabular-nums text-foreground">
                  {formatMoney(r.vatInputAmount, { withSymbol: false })}
                </div>
                <div className="py-3 text-right font-mono text-[12.5px] tabular-nums text-foreground">
                  {formatMoney(tdsAndAit.toFixed(4), { withSymbol: false })}
                </div>
                <div className="py-3 text-right font-mono text-[13px] font-semibold tabular-nums text-foreground">
                  {formatMoney(r.netPayableAmount, { withSymbol: false })}
                </div>
                <div className="py-3 text-right font-mono text-[12.5px] tabular-nums text-foreground">
                  {formatMoney(r.outstandingAmount, { withSymbol: false })}
                </div>
                <div className="py-3">
                  <BillStatusBadge status={r.status} />
                </div>
                <div className="flex justify-end py-3 text-faint">
                  <ChevronRight className="h-4 w-4" aria-hidden />
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
              <span className="font-semibold text-accent-ink">{r.entryNo ?? "Draft"}</span>
              <BillStatusBadge status={r.status} />
            </div>
            <div className="mt-1 text-[12.5px] text-muted-foreground [overflow-wrap:anywhere]">
              {supplierName(maps, r.supplierId)}
            </div>
            <div className="mt-0.5 text-[12.5px] text-muted-foreground [overflow-wrap:anywhere]">
              {projectName(maps, r.projectId)}
            </div>
            <div className="mt-1.5 grid grid-cols-2 gap-2 text-[12px]">
              <LabelVal label="Bill date" value={formatDate(r.billDate)} />
              <LabelVal
                label="Net payable"
                value={formatMoney(r.netPayableAmount, { withSymbol: false })}
              />
              <LabelVal
                label="Outstanding"
                value={formatMoney(r.outstandingAmount, { withSymbol: false })}
              />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function LabelVal({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[10.5px] uppercase tracking-[0.4px] text-faint">{label}</div>
      <div className="font-mono text-[12px] tabular-nums text-foreground [overflow-wrap:anywhere]">
        {value}
      </div>
    </div>
  );
}
