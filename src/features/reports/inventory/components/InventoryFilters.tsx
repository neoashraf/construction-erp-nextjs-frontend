"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { type ReportParams } from "../../types";
import { type InventoryReportTab } from "../types";

const SAMPLE_GODOWNS = [
  { id: "gd-a", label: "G-Site-A · Site A store" },
  { id: "gd-b", label: "G-Site-B · Site B store" },
  { id: "gd-c", label: "G-Central · Central warehouse" },
];
const SAMPLE_ITEMS = [
  { id: "it-1", label: "IT-101 · Cement — 50 kg bag" },
  { id: "it-2", label: "IT-102 · MS Rod 12mm" },
  { id: "it-3", label: "IT-103 · Sand — cft" },
];

/**
 * FE-58 report-specific filters (spec §7). Godown + Item optional on all
 * three; low-stock adds a Re-order level field; transfer summary uses its own
 * date-range (via the shared panel's date-from/to). Rendered as a lightweight
 * card below the panel so the shared panel stays untouched.
 */
export function InventoryFilters({
  tab,
  value,
  onChange,
  dateError,
}: {
  tab: InventoryReportTab;
  value: ReportParams;
  onChange: (next: ReportParams) => void;
  dateError?: string | null;
}) {
  const godownId = (value.extras?.godownId as string | undefined) ?? "";
  const itemId = (value.extras?.itemId as string | undefined) ?? "";
  const reorderLevel = (value.extras?.reorderLevel as string | undefined) ?? "";

  function setExtra(key: string, val: string | null) {
    onChange({
      ...value,
      extras: { ...(value.extras ?? {}), [key]: val ?? null },
    });
  }

  return (
    <div
      className="rounded-card border border-border bg-background p-4"
      data-testid="iv-filters"
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <Label htmlFor="iv-godown">Godown</Label>
          <select
            id="iv-godown"
            value={godownId}
            onChange={(e) => setExtra("godownId", e.target.value || null)}
            className="mt-1 block h-9 w-full rounded-token border border-border-strong bg-background px-3 text-sm text-foreground focus:border-accent focus:shadow-focus focus:outline-none"
            data-testid="iv-filter-godown"
          >
            <option value="">All godowns</option>
            {SAMPLE_GODOWNS.map((g) => (
              <option key={g.id} value={g.id}>
                {g.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="iv-item">Item</Label>
          <select
            id="iv-item"
            value={itemId}
            onChange={(e) => setExtra("itemId", e.target.value || null)}
            className="mt-1 block h-9 w-full rounded-token border border-border-strong bg-background px-3 text-sm text-foreground focus:border-accent focus:shadow-focus focus:outline-none"
            data-testid="iv-filter-item"
          >
            <option value="">All items</option>
            {SAMPLE_ITEMS.map((i) => (
              <option key={i.id} value={i.id}>
                {i.label}
              </option>
            ))}
          </select>
        </div>
        {tab === "LOW_STOCK" && (
          <div>
            <Label htmlFor="iv-reorder">Re-order level</Label>
            <Input
              id="iv-reorder"
              type="number"
              inputMode="decimal"
              min="0"
              value={reorderLevel}
              onChange={(e) => setExtra("reorderLevel", e.target.value || null)}
              placeholder="e.g. 500"
              data-testid="iv-filter-reorder"
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              Phase-1 parameter fallback — MAS Item re-order level is pending.
            </p>
          </div>
        )}
      </div>
      {dateError && (
        <p
          className={cn("mt-3 text-[12px] text-destructive")}
          role="alert"
          data-testid="iv-date-error"
        >
          {dateError}
        </p>
      )}
    </div>
  );
}
