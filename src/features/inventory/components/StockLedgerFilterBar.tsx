"use client";

import { useMemo, useState } from "react";
import { Search, Filter } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { type GodownOption, type ItemOption, type ProjectOption } from "../types";

/** The godown/item/project slice of the balances filter (as-of lives in the header). */
export interface LedgerScopeFilter {
  godownId: string;
  itemId: string;
  projectId: string;
}

/**
 * Stock-ledger balances filter bar (spec §4.A/§7). One horizontal row — Godown · Item ·
 * Project — ending with a Filters disclosure, a primary Apply + a ghost Clear filters
 * (design). Godown/Project are fixed-width button selects; Item is a flex-grow search box
 * that resolves a typed name/code to its `itemId` via a native datalist (the contract's
 * item filter is by id — no free-text param). Below lg the controls stack for the
 * site-facing ≥360 case. The as-of-date control is rendered in the page header.
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
  // Item is typed as free text (name or code) and resolved to an itemId on apply.
  const [itemQuery, setItemQuery] = useState(() => itemLabelFor(items, scope.itemId));
  const set = (patch: Partial<LedgerScopeFilter>) => setF((prev) => ({ ...prev, ...patch }));

  // Resolve the typed item text to an id: exact name/code match (case-insensitive).
  const resolvedItemId = useMemo(() => resolveItemId(items, itemQuery), [items, itemQuery]);

  function apply() {
    onApply({ ...f, itemId: resolvedItemId });
  }

  function clearAll() {
    setF({ godownId: "", itemId: "", projectId: "" });
    setItemQuery("");
    onClear();
  }

  return (
    <Card className="mt-4 p-4">
      <div className="flex flex-wrap items-end gap-3.5">
        {/* Godown — fixed width button select */}
        <div className="flex w-full flex-col gap-1.5 sm:w-[218px]">
          <Label htmlFor="sl-f-godown">Godown</Label>
          <Select
            id="sl-f-godown"
            value={f.godownId}
            data-testid="sl-f-godown"
            onChange={(e) => set({ godownId: e.target.value })}
          >
            <option value="">All godowns</option>
            {godowns.map((g) => (
              <option key={g.id} value={g.id}>
                {g.code} — {g.name}
              </option>
            ))}
          </Select>
        </div>

        {/* Item — flex-grow search input (name or code) */}
        <div className="flex min-w-[200px] flex-1 flex-col gap-1.5">
          <Label htmlFor="sl-f-item">Item</Label>
          <div
            className={cn(
              "flex h-9 items-center gap-2 rounded-token border border-border-strong bg-surface px-3",
              "focus-within:border-accent focus-within:shadow-focus",
            )}
          >
            <Search className="h-3.5 w-3.5 flex-none text-faint" aria-hidden />
            <input
              id="sl-f-item"
              value={itemQuery}
              list="sl-item-options"
              data-testid="sl-f-item"
              onChange={(e) => setItemQuery(e.target.value)}
              placeholder="Search item name or code"
              className="min-w-0 flex-1 bg-transparent text-[13.5px] text-foreground placeholder:text-faint focus:outline-none"
            />
            <datalist id="sl-item-options">
              {items.map((i) => (
                <option key={i.id} value={i.name}>
                  {i.code}
                </option>
              ))}
            </datalist>
          </div>
        </div>

        {/* Project — fixed width button select */}
        <div className="flex w-full flex-col gap-1.5 sm:w-[212px]">
          <Label htmlFor="sl-f-project">Project</Label>
          <Select
            id="sl-f-project"
            value={f.projectId}
            data-testid="sl-f-project"
            onChange={(e) => set({ projectId: e.target.value })}
          >
            <option value="">All projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.projectCode ? `${p.projectCode} — ${p.name}` : p.name}
              </option>
            ))}
          </Select>
        </div>

        {/* actions — Filters · Apply · Clear */}
        <div className="flex items-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="md"
            className="h-9 gap-1.5"
            data-testid="sl-f-filters"
          >
            <Filter className="h-3 w-3" aria-hidden />
            Filters
          </Button>
          <Button
            type="button"
            size="md"
            className="h-9"
            disabled={disabled}
            onClick={apply}
            data-testid="sl-f-apply"
          >
            Apply
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="md"
            className="h-9"
            onClick={clearAll}
            data-testid="sl-f-clear"
          >
            Clear filters
          </Button>
        </div>
      </div>
    </Card>
  );
}

/** The display label for an itemId (its name), or "" when none / unknown. */
function itemLabelFor(items: ItemOption[], itemId: string): string {
  return items.find((i) => i.id === itemId)?.name ?? "";
}

/** Resolve typed text to an itemId by exact (case-insensitive) name or code; "" if none. */
function resolveItemId(items: ItemOption[], query: string): string {
  const q = query.trim().toLowerCase();
  if (!q) return "";
  const hit = items.find((i) => i.name.toLowerCase() === q || i.code.toLowerCase() === q);
  return hit?.id ?? "";
}
