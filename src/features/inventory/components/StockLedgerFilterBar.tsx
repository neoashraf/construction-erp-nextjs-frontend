"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { type GodownOption, type ItemOption, type ProjectOption } from "../types";

/** The godown/item/project slice of the balances filter (as-of lives in the header). */
export interface LedgerScopeFilter {
  godownId: string;
  itemId: string;
  projectId: string;
}

/**
 * Stock-ledger balances filter bar (spec §4.A/§7). One horizontal row — Godown · Item ·
 * Project — ending with a primary Apply + a ghost Clear filters (design). Apply commits a
 * single query; Clear resets to defaults. Below lg the controls stack for the site-facing
 * ≥360 case. The as-of-date control is rendered in the page header (single global scope).
 */
export function StockLedgerFilterBar({
  scope,
  projects,
  godowns,
  items,
  disabled,
  onApply,
  onClear,
}: {
  scope: LedgerScopeFilter;
  projects: ProjectOption[];
  godowns: GodownOption[];
  items: ItemOption[];
  disabled?: boolean;
  onApply: (f: LedgerScopeFilter) => void;
  onClear: () => void;
}) {
  const [f, setF] = useState<LedgerScopeFilter>(scope);
  const set = (patch: Partial<LedgerScopeFilter>) => setF((prev) => ({ ...prev, ...patch }));

  function clearAll() {
    setF({ godownId: "", itemId: "", projectId: "" });
    onClear();
  }

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Godown" htmlFor="sl-f-godown">
          <Select id="sl-f-godown" value={f.godownId} data-testid="sl-f-godown" onChange={(e) => set({ godownId: e.target.value })}>
            <option value="">All godowns</option>
            {godowns.map((g) => (
              <option key={g.id} value={g.id}>
                {g.code} — {g.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Item" htmlFor="sl-f-item">
          <Select id="sl-f-item" value={f.itemId} data-testid="sl-f-item" onChange={(e) => set({ itemId: e.target.value })}>
            <option value="">All items</option>
            {items.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Project" htmlFor="sl-f-project">
          <Select id="sl-f-project" value={f.projectId} data-testid="sl-f-project" onChange={(e) => set({ projectId: e.target.value })}>
            <option value="">All projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.projectCode ? `${p.projectCode} — ${p.name}` : p.name}
              </option>
            ))}
          </Select>
        </Field>

        <div className="flex items-end gap-2">
          <Button type="button" size="md" disabled={disabled} onClick={() => onApply(f)} data-testid="sl-f-apply">
            Apply
          </Button>
          <Button type="button" variant="ghost" size="md" onClick={clearAll} data-testid="sl-f-clear">
            Clear filters
          </Button>
        </div>
      </div>
    </Card>
  );
}

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-[160px] flex-1 flex-col gap-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}
