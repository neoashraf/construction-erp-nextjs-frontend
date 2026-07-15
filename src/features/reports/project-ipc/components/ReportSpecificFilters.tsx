"use client";

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { type ReportParams } from "../../types";
import { type CostCentreVarianceStatus, type ProjectReportTab } from "../types";

const STATUS_OPTIONS: { value: CostCentreVarianceStatus; label: string }[] = [
  { value: "OK", label: "OK" },
  { value: "APPROACHING", label: "Approaching" },
  { value: "OVER", label: "Over budget" },
  { value: "UNBUDGETED", label: "Unbudgeted" },
];

/**
 * FE-57 report-specific filter slot (spec §7). Currently only the
 * material-consumption tab surfaces one — a `status` multi-select of
 * `OK/APPROACHING/OVER/UNBUDGETED`; empty = all statuses.
 */
export function ReportSpecificFilters({
  tab,
  value,
  onChange,
}: {
  tab: ProjectReportTab;
  value: ReportParams;
  onChange: (next: ReportParams) => void;
}) {
  if (tab !== "MATERIAL_CONSUMPTION") return null;

  const raw = (value.extras?.status as string | undefined) ?? "";
  const selected = new Set(raw ? raw.split(",") : []);

  function toggle(status: CostCentreVarianceStatus) {
    const next = new Set(selected);
    if (next.has(status)) next.delete(status);
    else next.add(status);
    onChange({
      ...value,
      extras: {
        ...(value.extras ?? {}),
        status: next.size ? Array.from(next).join(",") : null,
      },
    });
  }

  return (
    <div
      className="rounded-card border border-border bg-background p-4"
      data-testid="pi-mc-filters"
    >
      <Label className="text-[12px] font-semibold text-muted-foreground">Status</Label>
      <div
        role="group"
        aria-label="Filter by status"
        className="mt-2 flex flex-wrap gap-2"
      >
        {STATUS_OPTIONS.map((opt) => {
          const on = selected.has(opt.value);
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => toggle(opt.value)}
              aria-pressed={on}
              className={cn(
                "rounded-pill border px-3 py-1 text-[12px] font-semibold transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                on
                  ? "border-accent bg-accent-soft text-accent-ink"
                  : "border-border bg-background text-muted-foreground hover:bg-muted",
              )}
              data-testid={`pi-mc-status-${opt.value}`}
            >
              {opt.label}
            </button>
          );
        })}
        {selected.size > 0 && (
          <button
            type="button"
            onClick={() =>
              onChange({
                ...value,
                extras: { ...(value.extras ?? {}), status: null },
              })
            }
            className="text-[12px] font-semibold text-muted-foreground hover:text-foreground"
            data-testid="pi-mc-status-clear"
          >
            Clear
          </button>
        )}
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">
        Filter by CC variance status. No selection = all statuses.
      </p>
    </div>
  );
}
