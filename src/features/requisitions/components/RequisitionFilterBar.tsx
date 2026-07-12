"use client";

import { useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { DatePickerInput } from "@/components/ui/date-picker";
import { PRIORITIES, PRIORITY_LABEL, REQUISITION_STATUSES, STATUS_LABEL } from "../schemas/requisition.schema";
import { type CostCentreOption, type ProjectOption } from "../types";

export interface RequisitionFilter {
  status: string;
  priority: string;
  projectId: string;
  costCentreId: string;
  mine: boolean;
  requiredFrom: string; // DD/MM/YYYY
  requiredTo: string;
  hasOutstanding: boolean;
}

export const EMPTY_REQ_FILTER: RequisitionFilter = {
  status: "",
  priority: "",
  projectId: "",
  costCentreId: "",
  mine: false,
  requiredFrom: "",
  requiredTo: "",
  hasOutstanding: false,
};

/**
 * Requisition list filter bar (spec §4/§7). Primary row: Status · Priority · Project; a
 * "Filters" disclosure holds Cost centre · My requisitions · required-date range ·
 * hasOutstanding. Apply commits one query; Clear resets. Below lg the whole bar stacks (the
 * mobile design triggers it as a Filters sheet — the same controls in one column here).
 */
export function RequisitionFilterBar({
  applied,
  projects,
  costCentres,
  onApply,
  onClear,
}: {
  applied: RequisitionFilter;
  projects: ProjectOption[];
  costCentres: CostCentreOption[];
  onApply: (f: RequisitionFilter) => void;
  onClear: () => void;
}) {
  const [f, setF] = useState<RequisitionFilter>(applied);
  const [more, setMore] = useState(
    !!applied.costCentreId || applied.mine || !!applied.requiredFrom || !!applied.requiredTo || applied.hasOutstanding,
  );
  const set = (patch: Partial<RequisitionFilter>) => setF((prev) => ({ ...prev, ...patch }));

  function clearAll() {
    setF(EMPTY_REQ_FILTER);
    onClear();
  }

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Status" htmlFor="req-f-status">
          <Select id="req-f-status" value={f.status} data-testid="req-f-status" onChange={(e) => set({ status: e.target.value })}>
            <option value="">All statuses</option>
            {REQUISITION_STATUSES.map((s) => (
              <option key={s} value={s}>{STATUS_LABEL[s]}</option>
            ))}
          </Select>
        </Field>
        <Field label="Priority" htmlFor="req-f-priority">
          <Select id="req-f-priority" value={f.priority} data-testid="req-f-priority" onChange={(e) => set({ priority: e.target.value })}>
            <option value="">All priorities</option>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>
            ))}
          </Select>
        </Field>
        <Field label="Project" htmlFor="req-f-project">
          <Select id="req-f-project" value={f.projectId} data-testid="req-f-project" onChange={(e) => set({ projectId: e.target.value })}>
            <option value="">All projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.projectCode ? `${p.projectCode} — ${p.name}` : p.name}</option>
            ))}
          </Select>
        </Field>

        <div className="flex items-end gap-2">
          <Button type="button" variant="outline" size="md" className="gap-1.5" aria-expanded={more} onClick={() => setMore((s) => !s)} data-testid="req-f-more">
            <SlidersHorizontal className="h-4 w-4" aria-hidden />
            Filters
          </Button>
          <Button type="button" size="md" onClick={() => onApply(f)} data-testid="req-f-apply">Apply</Button>
          <Button type="button" variant="ghost" size="md" onClick={clearAll} data-testid="req-f-clear">Clear filters</Button>
        </div>
      </div>

      {more && (
        <div className="mt-3 flex flex-wrap items-end gap-3 border-t border-border pt-3" data-testid="req-f-disclosure">
          <Field label="Cost centre" htmlFor="req-f-cc">
            <Select id="req-f-cc" value={f.costCentreId} data-testid="req-f-cc" onChange={(e) => set({ costCentreId: e.target.value })}>
              <option value="">All cost centres</option>
              {costCentres.map((c) => (
                <option key={c.id} value={c.id}>{c.code} — {c.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Required from" htmlFor="req-f-from">
            <div className="w-[150px]"><DatePickerInput id="req-f-from" value={f.requiredFrom} onChange={(v) => set({ requiredFrom: v })} /></div>
          </Field>
          <Field label="Required to" htmlFor="req-f-to">
            <div className="w-[150px]"><DatePickerInput id="req-f-to" value={f.requiredTo} onChange={(v) => set({ requiredTo: v })} /></div>
          </Field>
          <label className="flex items-center gap-2 pb-2 text-[13px]">
            <Checkbox checked={f.mine} onChange={(e) => set({ mine: e.target.checked })} data-testid="req-f-mine" />
            My requisitions
          </label>
          <label className="flex items-center gap-2 pb-2 text-[13px]">
            <Checkbox checked={f.hasOutstanding} onChange={(e) => set({ hasOutstanding: e.target.checked })} data-testid="req-f-outstanding" />
            Has outstanding
          </label>
        </div>
      )}
    </Card>
  );
}

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-[150px] flex-1 flex-col gap-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}
