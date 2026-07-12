"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatMoney, formatQty, toDecimal } from "@/lib/money";
import { formatDate } from "@/lib/format";
import { RequisitionStatusBadge } from "./RequisitionStatusBadge";
import { PriorityBadge } from "./PriorityBadge";
import { type ProjectOption, type Requisition, type UserOption } from "../types";

/** id → display maps the screen passes down (Bangla-safe, never clipped). */
export interface ReqNameMaps {
  projects: Map<string, ProjectOption>;
  users: Map<string, UserOption>;
}

const GRID = "minmax(110px,1.1fr) minmax(120px,1.3fr) 96px 128px 104px 120px 110px minmax(96px,1fr) 40px";
const MONEY = "whitespace-nowrap font-mono text-[13px] tabular-nums";

function projectName(maps: ReqNameMaps, id: string): string {
  return maps.projects.get(id)?.name ?? id.slice(0, 8);
}
function requesterName(maps: ReqNameMaps, id: string | null): string {
  if (!id) return "—";
  return maps.users.get(id)?.name ?? "—";
}
/** Total outstanding quantity across lines (spec §5; FR-REQ-021), or null when none/unknown. */
function outstanding(r: Requisition): string | null {
  if (!r.lines || r.lines.length === 0) return null;
  const total = r.lines.reduce((acc, l) => acc.plus(toDecimal(l.balanceQuantity ?? "0")), toDecimal("0"));
  return total.gt(0) ? formatQty(total.toString(), 4) : null;
}

/**
 * Requisition list (spec §4). Full grid at ≥lg (scrolls within its own container if narrow);
 * stacked cards below lg for the site-facing ≥360 case. Requisition-no cell is the lime link
 * (or "Draft"); status + priority are pill+dot badges; money right-aligned + tabular. A row
 * opens its detail — the DRAFT entry form or (past-DRAFT) the read-only viewer.
 */
export function RequisitionList({ rows, maps }: { rows: Requisition[]; maps: ReqNameMaps }) {
  const router = useRouter();
  return (
    <div data-testid="req-list">
      {/* ≥lg table */}
      <div className="hidden overflow-x-auto lg:block">
        <div style={{ minWidth: 1000 }}>
          <div
            role="row"
            className="grid items-center gap-2 border-b border-border-strong bg-surface-2 px-4 text-[11px] font-semibold uppercase tracking-[0.4px] text-muted-foreground"
            style={{ gridTemplateColumns: GRID }}
          >
            <div className="py-3">Requisition no</div>
            <div className="py-3">Project</div>
            <div className="py-3">Priority</div>
            <div className="py-3">Status</div>
            <div className="py-3">Required</div>
            <div className="py-3 text-right">Est. value ৳</div>
            <div className="py-3 text-right">Outstanding</div>
            <div className="py-3">Requester</div>
            <div className="py-3" />
          </div>
          {rows.map((r) => {
            const out = outstanding(r);
            return (
              <div
                key={r.id}
                role="row"
                data-testid={`req-row-${r.status}`}
                className="grid cursor-pointer items-center gap-2 border-b border-muted px-4 hover:bg-surface-2"
                style={{ gridTemplateColumns: GRID }}
                onClick={() => router.push(`/requisitions/${r.id}`)}
              >
                <div className="min-w-0 py-3">
                  <Link
                    href={`/requisitions/${r.id}`}
                    className="font-semibold text-accent-ink hover:underline"
                    data-testid="req-open"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {r.requisitionNo ?? "Draft"}
                  </Link>
                </div>
                <div className="min-w-0 py-3 text-[13px] [overflow-wrap:anywhere]">{projectName(maps, r.projectId)}</div>
                <div className="py-3"><PriorityBadge priority={r.priority} /></div>
                <div className="py-3"><RequisitionStatusBadge status={r.status} /></div>
                <div className="py-3 text-[12.5px] tabular-nums text-muted-foreground">{formatDate(r.requiredDate)}</div>
                <div className="py-3 text-right">
                  {r.estimatedValue ? <span className={MONEY}>{formatMoney(r.estimatedValue)}</span> : <span className="text-faint">—</span>}
                </div>
                <div className="py-3 text-right">
                  {out ? <span className={cn(MONEY, "text-warning-ink")}>{out}</span> : <span className="text-faint">—</span>}
                </div>
                <div className="py-3 text-[13px] [overflow-wrap:anywhere]">{requesterName(maps, r.submittedById)}</div>
                <div className="flex justify-end py-3 text-faint">
                  <ChevronRight className="h-4 w-4" aria-hidden />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* <lg cards (site-facing ≥360) */}
      <div className="flex flex-col lg:hidden">
        {rows.map((r) => {
          const out = outstanding(r);
          return (
            <Link
              key={r.id}
              href={`/requisitions/${r.id}`}
              data-testid={`req-card-${r.status}`}
              className="border-b border-muted px-4 py-3 hover:bg-surface-2"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="font-semibold text-accent-ink">{r.requisitionNo ?? "Draft"}</span>
                <RequisitionStatusBadge status={r.status} />
              </div>
              <div className="mt-1 flex items-center gap-2 text-[12.5px] text-muted-foreground">
                <span className="[overflow-wrap:anywhere]">{projectName(maps, r.projectId)}</span>
                <PriorityBadge priority={r.priority} />
              </div>
              <div className="mt-1.5 grid grid-cols-3 gap-2 text-[12px]">
                <LabelVal label="Required" value={formatDate(r.requiredDate)} />
                <LabelVal label="Est. value" value={r.estimatedValue ? formatMoney(r.estimatedValue) : "—"} />
                <LabelVal label="Outstanding" value={out ?? "—"} />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function LabelVal({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[10.5px] uppercase tracking-[0.4px] text-faint">{label}</div>
      <div className="font-mono text-[12px] tabular-nums text-foreground [overflow-wrap:anywhere]">{value}</div>
    </div>
  );
}
