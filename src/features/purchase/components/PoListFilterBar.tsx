"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { DatePickerInput } from "@/components/ui/date-picker";
import { PO_STATUSES, PO_STATUS_LABEL } from "../schemas/order.schema";
import { StatusMultiSelect } from "./StatusMultiSelect";
import { type CostCentreOption, type ProjectOption, type SupplierOption } from "../types";

export interface PoFilter {
  projectId: string;
  supplierId: string;
  status: string[];
  dateFrom: string;
  dateTo: string;
}

export const EMPTY_PO_FILTER: PoFilter = {
  projectId: "",
  supplierId: "",
  status: [],
  dateFrom: "",
  dateTo: "",
};

/** Filter micro-label matched to Purchase Orders.dc.html (10.5px / 600 / 0.4px tracking). */
const FILTER_LABEL = "text-[10.5px] font-semibold uppercase tracking-[0.4px] text-muted-foreground";

/**
 * PO list filter bar (brief §Scope 3; spec §4/§6). One horizontal row of primary filters,
 * ordered per the design file: Supplier · Project · Status (multi-select chips) · Date from
 * · Date to — with Apply (primary) + Clear filters (ghost) at the right (Apply leftmost of
 * the pair). AND-combined server-side; status is sent as a csv the contract accepts. All
 * controls share the design-system focus/error states.
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
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex min-w-[180px] flex-[1.4] flex-col gap-1.5">
          <Label htmlFor="po-filter-supplier" className={FILTER_LABEL}>
            Supplier
          </Label>
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

        <div className="flex min-w-[180px] flex-[1.4] flex-col gap-1.5">
          <Label htmlFor="po-filter-project" className={FILTER_LABEL}>
            Project
          </Label>
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

        <div className="flex min-w-[168px] flex-[1.2] flex-col gap-1.5">
          <Label id="po-filter-status-label" className={FILTER_LABEL}>
            Status
          </Label>
          <StatusMultiSelect
            labelledBy="po-filter-status-label"
            options={PO_STATUSES.map((s) => ({ value: s, label: PO_STATUS_LABEL[s] }))}
            selected={draft.status}
            onChange={(status) => patch({ status })}
            placeholder="All statuses"
            testid="po-filter-status"
          />
        </div>

        <div className="flex min-w-[136px] flex-[1] flex-col gap-1.5">
          <Label htmlFor="po-filter-from" className={FILTER_LABEL}>
            Date from
          </Label>
          <DatePickerInput
            id="po-filter-from"
            value={draft.dateFrom}
            onChange={(v) => patch({ dateFrom: v })}
          />
        </div>

        <div className="flex min-w-[136px] flex-[1] flex-col gap-1.5">
          <Label htmlFor="po-filter-to" className={FILTER_LABEL}>
            Date to
          </Label>
          <DatePickerInput
            id="po-filter-to"
            value={draft.dateTo}
            onChange={(v) => patch({ dateTo: v })}
          />
        </div>

        <div className="flex items-end gap-1.5">
          <Button type="button" size="md" onClick={() => onApply(draft)} data-testid="po-filter-apply">
            Apply
          </Button>
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
            Clear filters
          </Button>
        </div>
      </div>
    </Card>
  );
}
