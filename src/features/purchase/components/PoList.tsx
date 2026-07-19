"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { MoreVertical } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { formatDate } from "@/lib/format";
import { moneyWithSymbol } from "../format";
import { PurchaseStatusBadge } from "./PurchaseStatusBadge";
import { type ProjectOption, type PurchaseOrderSummary, type SupplierOption } from "../types";

/** id → display maps the parent screen passes down (Bangla-safe, never clipped). */
export interface PoNameMaps {
  projects: Map<string, ProjectOption>;
  suppliers: Map<string, SupplierOption>;
}

// Columns follow Purchase Orders.dc.html: PO ref · Project · Supplier · PO date ·
// Expected delivery · Status · kebab. Status is the last data column before the kebab.
const GRID = "minmax(120px,1.2fr) minmax(140px,1.4fr) minmax(140px,1.4fr) 110px 130px 150px 44px";

function projectName(maps: PoNameMaps, id: string): string {
  const p = maps.projects.get(id);
  if (!p) return "(name unavailable)";
  return p.projectCode ? `${p.projectCode} — ${p.name}` : p.name;
}
function supplierName(maps: PoNameMaps, id: string): string {
  return maps.suppliers.get(id)?.name ?? "(name unavailable)";
}

/**
 * PO list (brief §Scope 3; spec §4/§5). Full grid at ≥lg (columns PO ref no · Project ·
 * Supplier · PO date · Expected delivery · Status · row-action kebab); stacked PO cards
 * below lg for the site-facing ≥360 case. PO-ref cell is the lime accent link (Draft badge
 * when null); status is a pill+dot badge; dates use `DD/MM/YYYY`, em-dash when absent. A
 * row opens its detail — the DRAFT editor or (past-DRAFT) the read-only viewer.
 */
export function PoList({
  rows,
  maps,
  basePath = "/purchase/orders",
}: {
  rows: PurchaseOrderSummary[];
  maps: PoNameMaps;
  basePath?: string;
}) {
  const router = useRouter();
  return (
    <div data-testid="po-list">
      {/* ≥lg table */}
      <div className="hidden overflow-x-auto lg:block">
        <div style={{ minWidth: 940 }}>
          <div
            role="row"
            className="grid items-center gap-2 border-b border-border-strong bg-surface-2 px-4 text-[11px] font-semibold uppercase tracking-[0.4px] text-muted-foreground"
            style={{ gridTemplateColumns: GRID }}
          >
            <div className="py-3">PO ref no</div>
            <div className="py-3">Project</div>
            <div className="py-3">Supplier</div>
            <div className="py-3">PO date</div>
            <div className="py-3">Expected delivery</div>
            <div className="py-3">Status</div>
            <div className="py-3" />
          </div>
          {rows.map((r) => (
            <div
              key={r.id}
              role="row"
              data-testid={`po-row-${r.status}`}
              className="grid cursor-pointer items-center gap-2 border-b border-muted px-4 hover:bg-surface-2"
              style={{ gridTemplateColumns: GRID }}
              onClick={() => router.push(`${basePath}/${r.id}`)}
            >
              <div className="min-w-0 py-3">
                <Link
                  href={`${basePath}/${r.id}`}
                  className="font-semibold text-accent-ink hover:underline"
                  data-testid="po-open"
                  onClick={(e) => e.stopPropagation()}
                >
                  {r.poRefNo ?? "Draft"}
                </Link>
              </div>
              <div className="min-w-0 py-3 text-[13px] [overflow-wrap:anywhere]">{projectName(maps, r.projectId)}</div>
              <div className="min-w-0 py-3 text-[13px] [overflow-wrap:anywhere]">{supplierName(maps, r.supplierId)}</div>
              <div className="py-3 text-[12.5px] tabular-nums text-muted-foreground">{formatDate(r.poDate)}</div>
              <div className="py-3 text-[12.5px] tabular-nums text-muted-foreground">
                {r.expectedDeliveryDate ? (
                  formatDate(r.expectedDeliveryDate)
                ) : (
                  <span className="text-faint">—</span>
                )}
              </div>
              <div className="py-3">
                <PurchaseStatusBadge status={r.status} />
              </div>
              <div className="flex justify-end py-3" onClick={(e) => e.stopPropagation()}>
                <RowActions id={r.id} basePath={basePath} label={r.poRefNo ?? "draft PO"} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* <lg cards */}
      <div className="flex flex-col lg:hidden">
        {rows.map((r) => (
          <Link
            key={r.id}
            href={`${basePath}/${r.id}`}
            data-testid={`po-card-${r.status}`}
            className="border-b border-muted px-4 py-3 hover:bg-surface-2"
          >
            <div className="flex items-start justify-between gap-2">
              <span className="font-semibold text-accent-ink">{r.poRefNo ?? "Draft"}</span>
              <PurchaseStatusBadge status={r.status} />
            </div>
            <div className="mt-1 text-[13px] font-semibold text-foreground [overflow-wrap:anywhere]">
              {supplierName(maps, r.supplierId)}
            </div>
            <div className="mt-0.5 text-[12.5px] text-muted-foreground [overflow-wrap:anywhere]">
              {projectName(maps, r.projectId)}
            </div>
            <div className="mt-2 flex items-center justify-between border-t border-muted pt-2 text-[12.5px]">
              <span className="text-muted-foreground">PO {formatDate(r.poDate)}</span>
              {r.orderTotalAmount != null && (
                <span className="font-mono font-semibold tabular-nums text-foreground">
                  {moneyWithSymbol(r.orderTotalAmount)}
                </span>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

/** Row-action kebab (design-system table pattern). Vertical ⋯; opens/views the PO. */
function RowActions({ id, basePath, label }: { id: string; basePath: string; label: string }) {
  const router = useRouter();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Actions for ${label}`}
        data-testid="po-row-actions"
        className="grid h-7 w-7 place-items-center rounded-token text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <MoreVertical className="h-4 w-4" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onSelect={() => router.push(`${basePath}/${id}`)} data-testid="po-row-open">
          Open
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
