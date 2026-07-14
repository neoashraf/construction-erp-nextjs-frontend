"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DatePickerInput } from "@/components/ui/date-picker";
import { BILL_STATUSES, BILL_STATUS_LABEL } from "../schemas/bill.schema";
import { type ProjectOption, type SupplierOption } from "../types";

export interface BillFilter {
  projectId: string;
  supplierId: string;
  status: string;
  purchaseOrderId: string;
  entryNo: string;
  dateFrom: string;
  dateTo: string;
}

export const EMPTY_BILL_FILTER: BillFilter = {
  projectId: "",
  supplierId: "",
  status: "",
  purchaseOrderId: "",
  entryNo: "",
  dateFrom: "",
  dateTo: "",
};

/**
 * Bill list filter bar (brief §Scope 3; spec §4/§6). Primary row = Project · Supplier ·
 * Status · Bill-date range with Apply/Clear; a "More filters" disclosure holds
 * `purchaseOrderId` + `entryNo`. AND-combined server-side. All controls share the
 * design-system focus/error states via `components/ui/*`.
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
  const [moreOpen, setMoreOpen] = useState(!!(applied.purchaseOrderId || applied.entryNo));
  const openProjects = projects.filter((p) => p.status !== "CLOSED");
  const activeSuppliers = suppliers.filter((s) => s.isActive || s.id === draft.supplierId);

  function patch(p: Partial<BillFilter>) {
    setDraft((prev) => ({ ...prev, ...p }));
  }

  return (
    <Card className="p-4" data-testid="bill-filter-bar">
      <div className="grid gap-3 md:grid-cols-6">
        <div className="md:col-span-2">
          <Label htmlFor="bill-filter-project">Project</Label>
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

        <div>
          <Label htmlFor="bill-filter-supplier">Supplier</Label>
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

        <div>
          <Label htmlFor="bill-filter-status">Status</Label>
          <Select
            id="bill-filter-status"
            value={draft.status}
            onChange={(e) => patch({ status: e.target.value })}
            data-testid="bill-filter-status"
          >
            <option value="">All statuses</option>
            {BILL_STATUSES.map((s) => (
              <option key={s} value={s}>
                {BILL_STATUS_LABEL[s]}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <Label htmlFor="bill-filter-from">Bill date from</Label>
          <DatePickerInput
            id="bill-filter-from"
            value={draft.dateFrom}
            onChange={(v) => patch({ dateFrom: v })}
          />
        </div>

        <div>
          <Label htmlFor="bill-filter-to">Bill date to</Label>
          <DatePickerInput
            id="bill-filter-to"
            value={draft.dateTo}
            onChange={(v) => patch({ dateTo: v })}
          />
        </div>
      </div>

      {moreOpen && (
        <div className="mt-3 grid gap-3 md:grid-cols-4" data-testid="bill-filter-more">
          <div className="md:col-span-2">
            <Label htmlFor="bill-filter-entry">Entry no</Label>
            <Input
              id="bill-filter-entry"
              value={draft.entryNo}
              onChange={(e) => patch({ entryNo: e.target.value })}
              placeholder="e.g. PUR/2526/0042"
              data-testid="bill-filter-entry"
            />
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="bill-filter-po">Purchase order id</Label>
            <Input
              id="bill-filter-po"
              value={draft.purchaseOrderId}
              onChange={(e) => patch({ purchaseOrderId: e.target.value })}
              placeholder="Bills raised against this PO"
              data-testid="bill-filter-po"
            />
          </div>
        </div>
      )}

      <div className="mt-3 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setMoreOpen((v) => !v)}
          className="text-[12px] font-semibold text-accent-ink hover:underline"
          data-testid="bill-filter-more-toggle"
          aria-expanded={moreOpen}
        >
          {moreOpen ? "Fewer filters" : "More filters"}
        </button>
        <div className="flex gap-2">
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
            Clear
          </Button>
          <Button type="button" size="md" onClick={() => onApply(draft)} data-testid="bill-filter-apply">
            Apply
          </Button>
        </div>
      </div>
    </Card>
  );
}
