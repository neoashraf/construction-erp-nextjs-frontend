"use client";

import { useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DatePickerInput } from "@/components/ui/date-picker";
import { BILL_STATUSES, BILL_STATUS_LABEL } from "../schemas/bill.schema";
import { StatusMultiSelect } from "./StatusMultiSelect";
import { type ProjectOption, type SupplierOption } from "../types";

export interface BillFilter {
  projectId: string;
  supplierId: string;
  status: string[];
  purchaseOrderId: string;
  entryNo: string;
  dateFrom: string;
  dateTo: string;
}

export const EMPTY_BILL_FILTER: BillFilter = {
  projectId: "",
  supplierId: "",
  status: [],
  purchaseOrderId: "",
  entryNo: "",
  dateFrom: "",
  dateTo: "",
};

/** Filter micro-label matched to Purchase Bill.dc.html (10.5px / 600 / 0.4px tracking). */
const FILTER_LABEL = "text-[10.5px] font-semibold uppercase tracking-[0.4px] text-muted-foreground";

/**
 * Bill list filter bar (brief §Scope 3; spec §4/§6). Primary row ordered per the design
 * file: Supplier · Project · Status (multi-select chips) · Date from · Date to · Entry no
 * (search) — then Apply (primary) + Clear filters (ghost). A "Filters" disclosure holds
 * the secondary From-PO filter. AND-combined server-side; status is sent as a csv.
 */
export function BillListFilterBar({
  applied,
  projects,
  suppliers,
  onApply,
  onClear,
}: {
  applied: BillFilter;
  projects: ProjectOption[];
  suppliers: SupplierOption[];
  onApply: (f: BillFilter) => void;
  onClear: () => void;
}) {
  const [draft, setDraft] = useState<BillFilter>(applied);
  const [moreOpen, setMoreOpen] = useState(!!applied.purchaseOrderId);
  const openProjects = projects.filter((p) => p.status !== "CLOSED");
  const activeSuppliers = suppliers.filter((s) => s.isActive || s.id === draft.supplierId);

  function patch(p: Partial<BillFilter>) {
    setDraft((prev) => ({ ...prev, ...p }));
  }

  return (
    <Card className="p-4" data-testid="bill-filter-bar">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex min-w-[170px] flex-[1.3] flex-col gap-1.5">
          <Label htmlFor="bill-filter-supplier" className={FILTER_LABEL}>
            Supplier
          </Label>
          <Select
            id="bill-filter-supplier"
            value={draft.supplierId}
            onChange={(e) => patch({ supplierId: e.target.value })}
            data-testid="bill-filter-supplier"
          >
            <option value="">All suppliers</option>
            {activeSuppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </div>

        <div className="flex min-w-[170px] flex-[1.3] flex-col gap-1.5">
          <Label htmlFor="bill-filter-project" className={FILTER_LABEL}>
            Project
          </Label>
          <Select
            id="bill-filter-project"
            value={draft.projectId}
            onChange={(e) => patch({ projectId: e.target.value })}
            data-testid="bill-filter-project"
          >
            <option value="">All projects</option>
            {openProjects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.projectCode ? `${p.projectCode} — ${p.name}` : p.name}
              </option>
            ))}
          </Select>
        </div>

        <div className="flex min-w-[160px] flex-[1.1] flex-col gap-1.5">
          <Label id="bill-filter-status-label" className={FILTER_LABEL}>
            Status
          </Label>
          <StatusMultiSelect
            labelledBy="bill-filter-status-label"
            options={BILL_STATUSES.map((s) => ({ value: s, label: BILL_STATUS_LABEL[s] }))}
            selected={draft.status}
            onChange={(status) => patch({ status })}
            placeholder="All statuses"
            testid="bill-filter-status"
          />
        </div>

        <div className="flex min-w-[130px] flex-[0.9] flex-col gap-1.5">
          <Label htmlFor="bill-filter-from" className={FILTER_LABEL}>
            Date from
          </Label>
          <DatePickerInput
            id="bill-filter-from"
            value={draft.dateFrom}
            onChange={(v) => patch({ dateFrom: v })}
          />
        </div>

        <div className="flex min-w-[130px] flex-[0.9] flex-col gap-1.5">
          <Label htmlFor="bill-filter-to" className={FILTER_LABEL}>
            Date to
          </Label>
          <DatePickerInput
            id="bill-filter-to"
            value={draft.dateTo}
            onChange={(v) => patch({ dateTo: v })}
          />
        </div>

        <div className="flex min-w-[150px] flex-[1] flex-col gap-1.5">
          <Label htmlFor="bill-filter-entry" className={FILTER_LABEL}>
            Entry no
          </Label>
          <Input
            id="bill-filter-entry"
            className="font-mono"
            value={draft.entryNo}
            onChange={(e) => patch({ entryNo: e.target.value })}
            placeholder="PUR/2526/…"
            data-testid="bill-filter-entry"
          />
        </div>

        <div className="flex items-end gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="md"
            className="gap-1.5"
            aria-expanded={moreOpen}
            aria-controls="bill-filter-more"
            onClick={() => setMoreOpen((v) => !v)}
            data-testid="bill-filter-more-toggle"
          >
            <SlidersHorizontal className="h-4 w-4" aria-hidden />
            Filters
            {draft.purchaseOrderId && (
              <span className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-pill bg-accent-soft px-1 text-[10.5px] font-bold text-accent-ink">
                1
              </span>
            )}
          </Button>
          <Button type="button" size="md" onClick={() => onApply(draft)} data-testid="bill-filter-apply">
            Apply
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="md"
            onClick={() => {
              setDraft(EMPTY_BILL_FILTER);
              setMoreOpen(false);
              onClear();
            }}
            data-testid="bill-filter-clear"
          >
            Clear filters
          </Button>
        </div>
      </div>

      {moreOpen && (
        <div
          id="bill-filter-more"
          className="mt-3 flex flex-wrap items-end gap-3 border-t border-border pt-3"
          data-testid="bill-filter-more"
        >
          <div className="flex min-w-[220px] flex-[1] flex-col gap-1.5">
            <Label htmlFor="bill-filter-po" className={FILTER_LABEL}>
              From PO
            </Label>
            <Input
              id="bill-filter-po"
              className="font-mono"
              value={draft.purchaseOrderId}
              onChange={(e) => patch({ purchaseOrderId: e.target.value })}
              placeholder="Bills raised against this PO"
              data-testid="bill-filter-po"
            />
          </div>
        </div>
      )}
    </Card>
  );
}
