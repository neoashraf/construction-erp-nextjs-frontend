"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { formatDate } from "@/lib/format";
import { GrnStatusBadge } from "./GrnStatusBadge";
import { type GrnSummary, type ProjectOption, type SupplierOption } from "../types";

export interface GrnNameMaps {
  projects: Map<string, ProjectOption>;
  suppliers: Map<string, SupplierOption>;
}

const GRID =
  "minmax(130px,1fr) minmax(160px,1.4fr) minmax(160px,1.4fr) 110px 90px 110px 110px 40px";

function projectName(maps: GrnNameMaps, id: string): string {
  const p = maps.projects.get(id);
  if (!p) return "(name unavailable)";
  return p.projectCode ? `${p.projectCode} — ${p.name}` : p.name;
}
function supplierName(maps: GrnNameMaps, id: string): string {
  return maps.suppliers.get(id)?.name ?? "(name unavailable)";
}

/**
 * GRN list (brief §Scope 3; spec §4). Full grid at ≥lg: GRN ref no · Supplier ·
 * Project · Receipt date · Ref (PO/Bill) · Ref id · Status · row action. Draft row
 * shows "Draft" in place of `grnRefNo`; identifier cell is the lime `accent-ink`
 * link. Row click routes DRAFT → editor, POSTED/CANCELLED → viewer (same route).
 * Below lg: stacked GRN cards (warehouse-floor use — often tablet or phone).
 */
export function GrnList({
  rows,
  maps,
  basePath = "/purchase/grn",
}: {
  rows: GrnSummary[];
  maps: GrnNameMaps;
  basePath?: string;
}) {
  const router = useRouter();

  return (
    <div data-testid="grn-list">
      {/* ≥lg data-grid */}
      <div className="hidden overflow-x-auto lg:block">
        <div style={{ minWidth: 1080 }}>
          <div
            role="row"
            className="grid items-center gap-2 border-b border-border-strong bg-surface-2 px-4 text-[11px] font-semibold uppercase tracking-[0.4px] text-muted-foreground"
            style={{ gridTemplateColumns: GRID }}
          >
            <div className="py-3">GRN ref no</div>
            <div className="py-3">Supplier</div>
            <div className="py-3">Project</div>
            <div className="py-3">Receipt date</div>
            <div className="py-3">Reference</div>
            <div className="py-3">Reference id</div>
            <div className="py-3">Status</div>
            <div className="py-3" />
          </div>
          {rows.map((r) => (
            <div
              key={r.id}
              role="row"
              data-testid={`grn-row-${r.status}`}
              className="grid cursor-pointer items-center gap-2 border-b border-muted px-4 hover:bg-surface-2"
              style={{ gridTemplateColumns: GRID }}
              onClick={() => router.push(`${basePath}/${r.id}`)}
            >
              <div className="min-w-0 py-3">
                <Link
                  href={`${basePath}/${r.id}`}
                  className="font-semibold text-accent-ink hover:underline"
                  data-testid="grn-open"
                  onClick={(e) => e.stopPropagation()}
                >
                  {r.grnRefNo ?? "Draft"}
                </Link>
              </div>
              <div className="min-w-0 py-3 text-[13px] [overflow-wrap:anywhere]">
                {supplierName(maps, r.supplierId)}
              </div>
              <div className="min-w-0 py-3 text-[13px] [overflow-wrap:anywhere]">
                {projectName(maps, r.projectId)}
              </div>
              <div className="py-3 text-[12.5px] tabular-nums text-muted-foreground">
                {formatDate(r.receiptDate)}
              </div>
              <div className="py-3 text-[12.5px] text-muted-foreground">
                {r.purchaseOrderId ? "PO" : r.purchaseBillId ? "Bill" : "—"}
              </div>
              <div className="py-3 font-mono text-[12px] text-muted-foreground [overflow-wrap:anywhere]">
                {r.purchaseOrderId ?? r.purchaseBillId ?? "—"}
              </div>
              <div className="py-3">
                <GrnStatusBadge status={r.status} />
              </div>
              <div className="flex justify-end py-3 text-faint">
                <ChevronRight className="h-4 w-4" aria-hidden />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* <lg stacked cards — warehouse-floor use (tablet/phone) */}
      <div className="flex flex-col lg:hidden">
        {rows.map((r) => (
          <Link
            key={r.id}
            href={`${basePath}/${r.id}`}
            data-testid={`grn-card-${r.status}`}
            className="border-b border-muted px-4 py-3 hover:bg-surface-2"
          >
            <div className="flex items-start justify-between gap-2">
              <span className="font-semibold text-accent-ink">{r.grnRefNo ?? "Draft"}</span>
              <GrnStatusBadge status={r.status} />
            </div>
            <div className="mt-1 text-[12.5px] text-muted-foreground [overflow-wrap:anywhere]">
              {supplierName(maps, r.supplierId)}
            </div>
            <div className="mt-0.5 text-[12.5px] text-muted-foreground [overflow-wrap:anywhere]">
              {projectName(maps, r.projectId)}
            </div>
            <div className="mt-1.5 grid grid-cols-2 gap-2 text-[12px]">
              <LabelVal label="Receipt date" value={formatDate(r.receiptDate)} />
              <LabelVal
                label="Reference"
                value={r.purchaseOrderId ? `PO ${r.purchaseOrderId}` : r.purchaseBillId ? `Bill ${r.purchaseBillId}` : "—"}
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
