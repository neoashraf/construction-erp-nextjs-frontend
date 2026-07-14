"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DatePickerInput } from "@/components/ui/date-picker";
import { GRN_STATUSES, GRN_STATUS_LABEL } from "../schemas/grn.schema";
import { type ProjectOption, type SupplierOption } from "../types";

export interface GrnFilter {
  projectId: string;
  supplierId: string;
  status: string;
  purchaseOrderId: string;
  purchaseBillId: string;
  grnRefNo: string;
  dateFrom: string;
  dateTo: string;
}

export const EMPTY_GRN_FILTER: GrnFilter = {
  projectId: "",
  supplierId: "",
  status: "",
  purchaseOrderId: "",
  purchaseBillId: "",
  grnRefNo: "",
  dateFrom: "",
  dateTo: "",
};

/**
 * GRN list filter bar (brief §Scope 3; spec §4). Primary row = Project · Supplier ·
 * Status · Receipt-date range with Apply/Clear; a "More filters" disclosure holds
 * `purchaseOrderId` / `purchaseBillId` / `grnRefNo`. AND-combined server-side.
 * All controls share the design-system focus/error states via `components/ui/*`.
 */
export function GrnListFilterBar({
  applied,
  projects,
  suppliers,
  onApply,
  onClear,
}: {
  applied: GrnFilter;
  projects: ProjectOption[];
  suppliers: SupplierOption[];
  onApply: (f: GrnFilter) => void;
  onClear: () => void;
}) {
  const [draft, setDraft] = useState<GrnFilter>(applied);
  const [moreOpen, setMoreOpen] = useState(
    !!(applied.purchaseOrderId || applied.purchaseBillId || applied.grnRefNo),
  );
  const openProjects = projects.filter((p) => p.status !== "CLOSED");
  const activeSuppliers = suppliers.filter((s) => s.isActive || s.id === draft.supplierId);

  function patch(p: Partial<GrnFilter>) {
    setDraft((prev) => ({ ...prev, ...p }));
  }

  return (
    <Card className="p-4" data-testid="grn-filter-bar">
      <div className="grid gap-3 md:grid-cols-6">
        <div className="md:col-span-2">
          <Label htmlFor="grn-filter-project">Project</Label>
          <Select
            id="grn-filter-project"
            value={draft.projectId}
            onChange={(e) => patch({ projectId: e.target.value })}
            data-testid="grn-filter-project"
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
          <Label htmlFor="grn-filter-supplier">Supplier</Label>
          <Select
            id="grn-filter-supplier"
            value={draft.supplierId}
            onChange={(e) => patch({ supplierId: e.target.value })}
            data-testid="grn-filter-supplier"
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
          <Label htmlFor="grn-filter-status">Status</Label>
          <Select
            id="grn-filter-status"
            value={draft.status}
            onChange={(e) => patch({ status: e.target.value })}
            data-testid="grn-filter-status"
          >
            <option value="">All statuses</option>
            {GRN_STATUSES.map((s) => (
              <option key={s} value={s}>
                {GRN_STATUS_LABEL[s]}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <Label htmlFor="grn-filter-from">Receipt date from</Label>
          <DatePickerInput
            id="grn-filter-from"
            value={draft.dateFrom}
            onChange={(v) => patch({ dateFrom: v })}
          />
        </div>

        <div>
          <Label htmlFor="grn-filter-to">Receipt date to</Label>
          <DatePickerInput
            id="grn-filter-to"
            value={draft.dateTo}
            onChange={(v) => patch({ dateTo: v })}
          />
        </div>
      </div>

      {moreOpen && (
        <div className="mt-3 grid gap-3 md:grid-cols-3" data-testid="grn-filter-more">
          <div>
            <Label htmlFor="grn-filter-ref">GRN ref no</Label>
            <Input
              id="grn-filter-ref"
              value={draft.grnRefNo}
              onChange={(e) => patch({ grnRefNo: e.target.value })}
              placeholder="e.g. GRN-2526/0001"
              data-testid="grn-filter-ref"
            />
          </div>
          <div>
            <Label htmlFor="grn-filter-po">Purchase order id</Label>
            <Input
              id="grn-filter-po"
              value={draft.purchaseOrderId}
              onChange={(e) => patch({ purchaseOrderId: e.target.value })}
              placeholder="GRNs raised against this PO"
              data-testid="grn-filter-po"
            />
          </div>
          <div>
            <Label htmlFor="grn-filter-bill">Purchase bill id</Label>
            <Input
              id="grn-filter-bill"
              value={draft.purchaseBillId}
              onChange={(e) => patch({ purchaseBillId: e.target.value })}
              placeholder="GRNs raised against this bill"
              data-testid="grn-filter-bill"
            />
          </div>
        </div>
      )}

      <div className="mt-3 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setMoreOpen((v) => !v)}
          className="text-[12px] font-semibold text-accent-ink hover:underline"
          data-testid="grn-filter-more-toggle"
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
              setDraft(EMPTY_GRN_FILTER);
              setMoreOpen(false);
              onClear();
            }}
            data-testid="grn-filter-clear"
          >
            Clear
          </Button>
          <Button type="button" size="md" onClick={() => onApply(draft)} data-testid="grn-filter-apply">
            Apply
          </Button>
        </div>
      </div>
    </Card>
  );
}
