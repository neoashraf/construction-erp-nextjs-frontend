"use client";

import { Lock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { formatDate, formatDateTime } from "@/lib/format";
import { toDecimal } from "@/lib/money";
import { moneyWithSymbol } from "../format";
import { PurchaseStatusBadge } from "./PurchaseStatusBadge";
import { BudgetBadge } from "./BudgetBadge";
import type {
  CostCentreOption,
  GodownOption,
  ItemOption,
  ProjectOption,
  PurchaseOrder,
  PurposeOption,
  SupplierOption,
} from "../types";

/** `DD/MM/YYYY HH:MM` → `DD/MM/YYYY · HH:MM` (design approval-meta separator). */
function approvedAtLabel(iso: string): string {
  return formatDateTime(iso).replace(" ", " · ");
}

/**
 * Read-only APPROVED / terminal Purchase Order view (Purchase Orders.dc.html — "Editor · approved
 * PO (read-only)" artboard; FR-PUR-002/-017/-019). Structurally distinct from the editable grid:
 * a PO-ref header strip with a lock affordance, read-only header field pills, the approval meta
 * line, and a display line table showing per-line Billed / Received + the advisory budget badge,
 * closing with PO ORDER TOTAL. No inputs, no Add line, no per-line remove — the parent renders the
 * Back · Cancel-PO action bar. All money is Decimal(18,4) end-to-end, rendered ৳ + 2dp.
 */
export function PoReadOnlyView({
  po,
  projects,
  suppliers,
  items,
  costCentres,
  purposes,
  godowns,
}: {
  po: PurchaseOrder;
  projects: ProjectOption[];
  suppliers: SupplierOption[];
  items: ItemOption[];
  costCentres: CostCentreOption[];
  purposes: PurposeOption[];
  godowns: GodownOption[];
}) {
  const projectName =
    projects.find((p) => p.id === po.projectId)?.name ?? po.projectId;
  const supplierName =
    suppliers.find((s) => s.id === po.supplierId)?.name ?? po.supplierId;

  const total = po.lines.reduce(
    (sum, l) => sum.plus(toDecimal(l.lineAmount ?? toDecimal(l.orderedQty).times(toDecimal(l.rate)).toFixed(4))),
    toDecimal("0"),
  );

  return (
    <div className="flex flex-col gap-3" data-testid="po-readonly-view">
      {/* HEADER CARD — ref strip · read-only fields · approval meta */}
      <Card className="p-4">
        <div className="mb-3.5 flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3.5">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-[10.5px] font-semibold uppercase tracking-[0.4px] text-faint">
              PO ref no
            </span>
            <span className="font-mono text-[14px] font-semibold text-foreground" data-testid="po-ref">
              {po.poRefNo ?? "(pending)"}
            </span>
            <PurchaseStatusBadge status={po.status} />
          </div>
          <span className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground">
            <Lock className="h-3.5 w-3.5 text-faint" aria-hidden />
            Approved PO — read-only
          </span>
        </div>

        <div className="flex flex-wrap items-start gap-3.5">
          <ReadField label="Project" required className="w-[236px]" value={projectName} chevron />
          <ReadField label="Supplier" required className="w-[236px]" value={supplierName} chevron />
          <ReadField label="PO date" required className="w-[150px]" value={isoToUi(po.poDate)} calendar />
          <ReadField
            label="Expected delivery"
            optional
            className="w-[170px]"
            value={po.expectedDeliveryDate ? isoToUi(po.expectedDeliveryDate) : "—"}
            calendar={!!po.expectedDeliveryDate}
          />
          <ReadField
            label="Narration"
            optional
            className="min-w-[240px] flex-1"
            value={po.narration?.trim() ? po.narration : "—"}
            muted={!po.narration?.trim()}
          />
        </div>

        <div className="mt-3.5 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-border pt-3.5">
          <span className="inline-flex items-center gap-2 text-[12.5px] text-foreground" data-testid="po-approved-meta">
            <span className="h-1.5 w-1.5 rounded-full bg-success" aria-hidden />
            <span className="text-muted-foreground">Approved</span>{" "}
            <span className="font-semibold">
              {po.approvedAt ? approvedAtLabel(po.approvedAt) : "—"}
            </span>{" "}
            <span className="text-muted-foreground">by</span>{" "}
            <span className="font-semibold">
              {po.approvedBy?.trim() ? po.approvedBy : <span className="text-faint">(name unavailable)</span>}
            </span>
          </span>
          <span className="ml-auto text-[12px] text-muted-foreground">
            Bills &amp; GRNs draw against this PO&apos;s open lines.
          </span>
        </div>
      </Card>

      {/* LINE TABLE — display only, with per-line billed/received + budget, closing with PO order total */}
      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <div className="min-w-[1000px]">
            <div
              role="row"
              className="grid items-center border-b border-border-strong bg-surface-2 text-[11px] font-semibold uppercase tracking-[0.4px] text-muted-foreground"
              style={{ gridTemplateColumns: RO_GRID }}
            >
              <div className="px-2.5 py-3">#</div>
              <div className="px-3 py-3">Item</div>
              <div className="px-3 py-3 text-right">Ordered qty</div>
              <div className="px-3 py-3 text-right">Rate ৳</div>
              <div className="px-3 py-3 text-right">Line amount ৳</div>
              <div className="flex items-center gap-1.5 px-3 py-3">
                Dimensions{" "}
                <span className="font-medium normal-case tracking-normal text-faint">
                  — godown · cost centre · purpose
                </span>
              </div>
              <div className="px-3 py-3">Budget</div>
            </div>

            {po.lines.map((l, i) => {
              const item = items.find((it) => it.id === l.itemId);
              const godown = godowns.find((g) => g.id === l.godownId);
              const cc = costCentres.find((c) => c.id === l.costCentreId);
              const purpose = purposes.find((p) => p.id === l.purposeId);
              const amount = l.lineAmount ?? toDecimal(l.orderedQty).times(toDecimal(l.rate)).toFixed(4);
              return (
                <div
                  key={l.lineNo ?? i}
                  className="grid items-start border-b border-border"
                  style={{ gridTemplateColumns: RO_GRID }}
                >
                  <div className="px-2.5 py-3.5 font-mono text-[12.5px] font-semibold tabular-nums text-faint">
                    {l.lineNo ?? i + 1}
                  </div>
                  <div className="min-w-0 px-3 py-3">
                    <ReadPill value={item?.name ?? l.itemId} chevron />
                    <div className="mt-1.5 flex gap-3 pl-0.5 text-[11px] tabular-nums text-muted-foreground">
                      <span>
                        Billed <b className="text-foreground">{qty(l.billedQty)}</b>
                      </span>
                      <span>
                        Received <b className="text-foreground">{qty(l.receivedQty)}</b>
                      </span>
                    </div>
                  </div>
                  <div className="px-3 py-3">
                    <ReadPill value={qty(l.orderedQty)} align="right" />
                  </div>
                  <div className="px-3 py-3">
                    <ReadPill value={moneyWithSymbol(l.rate)} align="right" />
                  </div>
                  <div className="px-3 py-3.5 text-right font-mono text-[13px] font-semibold tabular-nums text-foreground">
                    {moneyWithSymbol(amount)}
                  </div>
                  <div className="min-w-0 px-3 py-3">
                    <div className="mb-1.5 flex items-center gap-1.5 px-0.5">
                      <span className="text-[9.5px] font-bold uppercase tracking-[0.4px] text-faint">
                        Project
                      </span>
                      <span className="truncate text-[11.5px] text-muted-foreground">{projectName}</span>
                      <span className="text-[9.5px] text-faint">· from header</span>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <DimPill tag="GDN" value={godown ? `${godown.code} — ${godown.name}` : l.godownId} />
                      <DimPill tag="CC" value={cc ? cc.name : l.costCentreId} />
                      <DimPill tag="PUR" value={purpose ? purpose.name : l.purposeId} />
                    </div>
                  </div>
                  <div className="px-3 py-3.5">
                    {l.budgetStatus ? (
                      <BudgetBadge status={l.budgetStatus} />
                    ) : (
                      <span className="text-[12px] text-faint">—</span>
                    )}
                  </div>
                </div>
              );
            })}

            <div className="flex items-center gap-2.5 bg-surface-2 px-4 py-3">
              <span className="ml-auto text-[11px] font-semibold uppercase tracking-[0.4px] text-muted-foreground">
                PO order total
              </span>
              <span className="text-[18px] font-bold tabular-nums text-foreground" data-testid="po-order-total">
                {moneyWithSymbol(total.toFixed(4))}
              </span>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

// # · Item · Ordered qty · Rate · Line amount · Dimensions · Budget (Purchase Orders.dc.html
// read-only grid — no per-line remove column in read-only).
const RO_GRID = "30px minmax(180px,1.6fr) 96px 110px 130px minmax(220px,1.5fr) 150px";

function isoToUi(iso: string): string {
  try {
    return formatDate(iso.length > 10 ? iso.slice(0, 10) : iso);
  } catch {
    return iso;
  }
}

function qty(v: string | null | undefined): string {
  if (v == null || v === "") return "—";
  return toDecimal(v).toFixed(3);
}

/** A read-only header field: micro-label (with a required or optional hint) over a display pill. */
function ReadField({
  label,
  required,
  optional,
  value,
  className,
  chevron,
  calendar,
  muted,
}: {
  label: string;
  required?: boolean;
  optional?: boolean;
  value: string;
  className?: string;
  chevron?: boolean;
  calendar?: boolean;
  muted?: boolean;
}) {
  return (
    <div className={`flex flex-col gap-1.5 ${className ?? ""}`}>
      <label className="text-[10.5px] font-semibold uppercase tracking-[0.4px] text-muted-foreground">
        {label}
        {required && <span className="ml-0.5 text-destructive"> *</span>}
        {optional && (
          <span className="ml-1 font-medium normal-case tracking-normal text-faint">— optional</span>
        )}
      </label>
      <ReadPill value={value} chevron={chevron} calendar={calendar} muted={muted} />
    </div>
  );
}

/** The shared read-only "field" look: a bordered pill on surface-2, an optional trailing glyph. */
function ReadPill({
  value,
  align = "left",
  chevron,
  calendar,
  muted,
}: {
  value: string;
  align?: "left" | "right";
  chevron?: boolean;
  calendar?: boolean;
  muted?: boolean;
}) {
  return (
    <div
      className={`flex min-h-9 items-center gap-2 rounded-token border border-border-strong bg-surface-2 px-2.5 ${
        align === "right" ? "justify-end" : "justify-between"
      }`}
    >
      <span
        className={`min-w-0 truncate text-[13px] tabular-nums ${muted ? "text-faint" : "text-foreground"}`}
      >
        {value}
      </span>
      {chevron && <span className="flex-none text-[11px] text-faint">▾</span>}
      {calendar && (
        <svg
          className="h-3.5 w-3.5 flex-none text-faint"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          aria-hidden
        >
          <rect x="3" y="5" width="18" height="16" rx="2.5" />
          <line x1="3" y1="10" x2="21" y2="10" />
          <line x1="8" y1="3" x2="8" y2="7" />
          <line x1="16" y1="3" x2="16" y2="7" />
        </svg>
      )}
    </div>
  );
}

/** A dimension pill in the read-only line cell: uppercase tag + resolved value + a chevron glyph. */
function DimPill({ tag, value }: { tag: string; value: string }) {
  return (
    <div className="flex min-h-8 items-center justify-between gap-2 rounded-md border border-border-strong bg-surface-2 px-2.5">
      <span className="inline-flex min-w-0 items-center gap-1.5">
        <span className="flex-none text-[9.5px] font-bold uppercase tracking-[0.4px] text-faint">
          {tag}
        </span>
        <span className="truncate text-[12.5px] text-foreground">{value}</span>
      </span>
      <span className="flex-none text-[10px] text-faint">▾</span>
    </div>
  );
}
