"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { DatePickerInput } from "@/components/ui/date-picker";
import { PO_STATUSES, PO_STATUS_LABEL } from "../schemas/order.schema";
import { type CostCentreOption, type ProjectOption, type SupplierOption } from "../types";

export interface PoFilter {
  projectId: string;
  supplierId: string;
  status: string;
  dateFrom: string;
  dateTo: string;
}

export const EMPTY_PO_FILTER: PoFilter = {
  projectId: "",
  supplierId: "",
  status: "",
  dateFrom: "",
  dateTo: "",
};

/**
 * PO list filter bar (brief §Scope 3; spec §4/§6). One horizontal row of primary
 * filters — Project · Supplier · Status · PO-date range — with Apply (primary) + Clear
 * (ghost) at the right. AND-combined server-side. All controls share the design-system
 * focus/error states via `components/ui/select` + `date-picker`.
 */
export function PoListFilterBar({
  applied,
  projects,
  suppliers,
  onApply,
  onClear,
}: {
  applied: PoFilter;
  projects: ProjectOption[];
  suppliers: SupplierOption[];
  costCentres?: CostCentreOption[];
  onApply: (f: PoFilter) => void;
  onClear: () => void;
}) {
  const [draft, setDraft] = useState<PoFilter>(applied);
  const openProjects = projects.filter((p) => p.status !== "CLOSED");
  const activeSuppliers = suppliers.filter((s) => s.isActive || s.id === draft.supplierId);

  function patch(p: Partial<PoFilter>) {
    setDraft((prev) => ({ ...prev, ...p }));
  }

  return (
    <Card className="p-4" data-testid="po-filter-bar">
      <div className="grid gap-3 md:grid-cols-6">
        <div className="md:col-span-2">
          <Label htmlFor="po-filter-project">Project</Label>
          <Select
            id="po-filter-project"
            value={draft.projectId}
            onChange={(e) => patch({ projectId: e.target.value })}
            data-testid="po-filter-project"
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
          <Label htmlFor="po-filter-supplier">Supplier</Label>
          <Select
            id="po-filter-supplier"
            value={draft.supplierId}
            onChange={(e) => patch({ supplierId: e.target.value })}
            data-testid="po-filter-supplier"
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
          <Label htmlFor="po-filter-status">Status</Label>
          <Select
            id="po-filter-status"
            value={draft.status}
            onChange={(e) => patch({ status: e.target.value })}
            data-testid="po-filter-status"
          >
            <option value="">All statuses</option>
            {PO_STATUSES.map((s) => (
              <option key={s} value={s}>
                {PO_STATUS_LABEL[s]}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <Label htmlFor="po-filter-from">PO date from</Label>
          <DatePickerInput
            id="po-filter-from"
            value={draft.dateFrom}
            onChange={(v) => patch({ dateFrom: v })}
          />
        </div>

        <div>
          <Label htmlFor="po-filter-to">PO date to</Label>
          <DatePickerInput
            id="po-filter-to"
            value={draft.dateTo}
            onChange={(v) => patch({ dateTo: v })}
          />
        </div>
      </div>

      <div className="mt-3 flex justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          size="md"
          onClick={() => {
            setDraft(EMPTY_PO_FILTER);
            onClear();
          }}
          data-testid="po-filter-clear"
        >
          Clear
        </Button>
        <Button type="button" size="md" onClick={() => onApply(draft)} data-testid="po-filter-apply">
          Apply
        </Button>
      </div>
    </Card>
  );
}
