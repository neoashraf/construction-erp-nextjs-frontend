"use client";

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { type ReportParams } from "../../types";
import { type CostCentreVarianceStatus } from "../types";

const STATUS_OPTIONS: { value: CostCentreVarianceStatus; label: string }[] = [
  { value: "OK", label: "OK" },
  { value: "APPROACHING", label: "Approaching" },
  { value: "OVER", label: "Over budget" },
  { value: "UNBUDGETED", label: "Unbudgeted" },
];

/** FE-59 cost-centre-variance status multi-select chips (spec §7). */
export function StatusFilterChips({
  value,
  onChange,
}: {
  value: ReportParams;
  onChange: (next: ReportParams) => void;
}) {
  const raw = (value.extras?.status as string | undefined) ?? "";
  const selected = new Set(raw ? raw.split(",") : []);

  function toggle(s: CostCentreVarianceStatus) {
    const next = new Set(selected);
    if (next.has(s)) next.delete(s);
    else next.add(s);
    onChange({
      ...value,
      extras: {
        ...(value.extras ?? {}),
        status: next.size ? Array.from(next).join(",") : null,
      },
    });
  }

  return (
    <div>
      <Label className="text-[12px] font-semibold text-muted-foreground">Status</Label>
      <div role="group" aria-label="Filter by status" className="mt-2 flex flex-wrap gap-2">
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
              data-testid={`rcc-status-chip-${opt.value}`}
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
            data-testid="rcc-status-clear"
          >
            Clear
          </button>
        )}
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">
        No selection = all statuses.
      </p>
    </div>
  );
}
