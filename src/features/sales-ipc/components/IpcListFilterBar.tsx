"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { DatePickerInput } from "@/components/ui/date-picker";
import { IPC_STATUSES, STATUS_LABEL } from "../schemas/ipc.schema";
import { type CustomerOption, type ProjectOption } from "../types";

export interface IpcFilter {
  projectId: string;
  customerId: string;
  status: string;
  dateFrom: string; // DD/MM/YYYY
  dateTo: string;
}

export const EMPTY_IPC_FILTER: IpcFilter = {
  projectId: "",
  customerId: "",
  status: "",
  dateFrom: "",
  dateTo: "",
};

/**
 * IPC list filter bar (spec §4/§7; design "IPC list"). One horizontal row of AND-combined
 * filters — Project · Customer · Status · IPC-date range — with Apply (primary) + Clear (ghost).
 * Apply commits one query; Clear resets. Below lg the row stacks into a single column.
 */
export function IpcListFilterBar({
  applied,
  projects,
  customers,
  onApply,
  onClear,
}: {
  applied: IpcFilter;
  projects: ProjectOption[];
  customers: CustomerOption[];
  onApply: (f: IpcFilter) => void;
  onClear: () => void;
}) {
  const [f, setF] = useState<IpcFilter>(applied);
  const set = (patch: Partial<IpcFilter>) => setF((prev) => ({ ...prev, ...patch }));

  function clearAll() {
    setF(EMPTY_IPC_FILTER);
    onClear();
  }

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Project" htmlFor="ipc-f-project">
          <Select id="ipc-f-project" value={f.projectId} data-testid="ipc-f-project" onChange={(e) => set({ projectId: e.target.value })}>
            <option value="">All projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.projectCode ? `${p.projectCode} — ${p.name}` : p.name}</option>
            ))}
          </Select>
        </Field>
        <Field label="Customer" htmlFor="ipc-f-customer">
          <Select id="ipc-f-customer" value={f.customerId} data-testid="ipc-f-customer" onChange={(e) => set({ customerId: e.target.value })}>
            <option value="">All customers</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
        </Field>
        <Field label="Status" htmlFor="ipc-f-status">
          <Select id="ipc-f-status" value={f.status} data-testid="ipc-f-status" onChange={(e) => set({ status: e.target.value })}>
            <option value="">All statuses</option>
            {IPC_STATUSES.map((s) => (
              <option key={s} value={s}>{STATUS_LABEL[s]}</option>
            ))}
          </Select>
        </Field>
        <Field label="IPC date from" htmlFor="ipc-f-from">
          <div className="w-[150px]"><DatePickerInput id="ipc-f-from" value={f.dateFrom} onChange={(v) => set({ dateFrom: v })} /></div>
        </Field>
        <Field label="to" htmlFor="ipc-f-to">
          <div className="w-[150px]"><DatePickerInput id="ipc-f-to" value={f.dateTo} onChange={(v) => set({ dateTo: v })} /></div>
        </Field>

        <div className="flex items-end gap-2">
          <Button type="button" size="md" onClick={() => onApply(f)} data-testid="ipc-f-apply">Apply</Button>
          <Button type="button" variant="ghost" size="md" onClick={clearAll} data-testid="ipc-f-clear">Clear filters</Button>
        </div>
      </div>
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
