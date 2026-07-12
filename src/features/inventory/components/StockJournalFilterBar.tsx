"use client";

import { useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { MODE_LABEL, STOCK_JOURNAL_MODES } from "../schemas/stock-journal.schema";
import { type GodownOption, type ItemOption, type ProjectOption, type StockJournalStatus } from "../types";

export interface StockJournalFilter {
  status: string;
  mode: string;
  projectId: string;
  godownId: string;
  itemId: string;
  dateFrom: string;
  dateTo: string;
}

export const EMPTY_SJ_FILTER: StockJournalFilter = {
  status: "",
  mode: "",
  projectId: "",
  godownId: "",
  itemId: "",
  dateFrom: "",
  dateTo: "",
};

const STATUSES: StockJournalStatus[] = ["DRAFT", "APPROVED", "POSTED", "CANCELLED"];
const STATUS_LABEL: Record<StockJournalStatus, string> = {
  DRAFT: "Draft",
  APPROVED: "Approved",
  POSTED: "Posted",
  CANCELLED: "Cancelled",
};

/**
 * Stock Journal list filter bar (spec §4.A/§9). Primary row: Status · Mode · Project ·
 * Godown; a "Filters" disclosure holds Item + the date range. Apply commits (a single
 * query, no chatty per-keystroke fetch); Clear resets to defaults. Below lg the whole bar
 * stacks; on the site-facing mobile it becomes the same controls in one column.
 */
export function StockJournalFilterBar({
  applied,
  projects,
  godowns,
  items,
  onApply,
  onClear,
}: {
  applied: StockJournalFilter;
  projects: ProjectOption[];
  godowns: GodownOption[];
  items: ItemOption[];
  onApply: (f: StockJournalFilter) => void;
  onClear: () => void;
}) {
  const [f, setF] = useState<StockJournalFilter>(applied);
  const [showMore, setShowMore] = useState(!!applied.itemId || !!applied.dateFrom || !!applied.dateTo);
  const set = (patch: Partial<StockJournalFilter>) => setF((prev) => ({ ...prev, ...patch }));

  function clearAll() {
    setF(EMPTY_SJ_FILTER);
    onClear();
  }

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Status" htmlFor="sj-f-status">
          <Select id="sj-f-status" value={f.status} data-testid="sj-f-status" onChange={(e) => set({ status: e.target.value })}>
            <option value="">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>{STATUS_LABEL[s]}</option>
            ))}
          </Select>
        </Field>
        <Field label="Mode" htmlFor="sj-f-mode">
          <Select id="sj-f-mode" value={f.mode} data-testid="sj-f-mode" onChange={(e) => set({ mode: e.target.value })}>
            <option value="">All modes</option>
            {STOCK_JOURNAL_MODES.map((mo) => (
              <option key={mo} value={mo}>{MODE_LABEL[mo]}</option>
            ))}
          </Select>
        </Field>
        <Field label="Project" htmlFor="sj-f-project">
          <Select id="sj-f-project" value={f.projectId} data-testid="sj-f-project" onChange={(e) => set({ projectId: e.target.value })}>
            <option value="">All projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.projectCode ? `${p.projectCode} — ${p.name}` : p.name}</option>
            ))}
          </Select>
        </Field>
        <Field label="Godown" htmlFor="sj-f-godown">
          <Select id="sj-f-godown" value={f.godownId} data-testid="sj-f-godown" onChange={(e) => set({ godownId: e.target.value })}>
            <option value="">All godowns</option>
            {godowns.map((g) => (
              <option key={g.id} value={g.id}>{g.code} — {g.name}</option>
            ))}
          </Select>
        </Field>

        <div className="flex items-end gap-2">
          <Button type="button" variant="outline" size="md" className="gap-1.5" aria-expanded={showMore} onClick={() => setShowMore((s) => !s)} data-testid="sj-f-more">
            <SlidersHorizontal className="h-4 w-4" aria-hidden />
            Filters
          </Button>
          <Button type="button" size="md" onClick={() => onApply(f)} data-testid="sj-f-apply">Apply</Button>
          <Button type="button" variant="ghost" size="md" onClick={clearAll} data-testid="sj-f-clear">Clear filters</Button>
        </div>
      </div>

      {showMore && (
        <div className="mt-3 flex flex-wrap items-end gap-3 border-t border-border pt-3" data-testid="sj-f-disclosure">
          <Field label="Item" htmlFor="sj-f-item">
            <Select id="sj-f-item" value={f.itemId} data-testid="sj-f-item" onChange={(e) => set({ itemId: e.target.value })}>
              <option value="">All items</option>
              {items.map((i) => (
                <option key={i.id} value={i.id}>{i.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Date from" htmlFor="sj-f-from">
            <Input id="sj-f-from" type="date" className="tabular-nums" value={f.dateFrom} data-testid="sj-f-from" onChange={(e) => set({ dateFrom: e.target.value })} />
          </Field>
          <Field label="Date to" htmlFor="sj-f-to">
            <Input id="sj-f-to" type="date" className="tabular-nums" value={f.dateTo} data-testid="sj-f-to" onChange={(e) => set({ dateTo: e.target.value })} />
          </Field>
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
