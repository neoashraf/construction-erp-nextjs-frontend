"use client";

import { cn } from "@/lib/utils";

/**
 * Shared report-type switcher — the light **chip row** the design uses at the top
 * of every report viewer (trial-balance & ledgers, financial statements, project,
 * inventory, RCC, HR). Each report is a pill with a leading meaning-dot:
 *   • violet = a balance / as-of report      • blue = a flow / date-range report
 *   • amber  = a budget-variance report
 * The active chip is a white pill with a subtle border + shadow and dark text; the
 * rest are ghost chips with muted text. This replaces the old boxed segmented
 * control (`bg-foreground text-background`) so the viewers match their `.dc.html`.
 *
 * WAI-ARIA tab pattern: `role="tablist"` + roving `tabIndex`, ArrowLeft/ArrowRight
 * to move between chips (wrapping).
 */
export type ReportChipTone = "violet" | "blue" | "amber";

export interface ReportChip<Id extends string> {
  id: Id;
  label: string;
  tone: ReportChipTone;
}

const DOT: Record<ReportChipTone, string> = {
  violet: "bg-violet",
  blue: "bg-info",
  amber: "bg-warning",
};

export function ReportTypeSwitcher<Id extends string>({
  ariaLabel,
  chips,
  value,
  onChange,
  testId,
  chipTestId,
}: {
  ariaLabel: string;
  chips: ReadonlyArray<ReportChip<Id>>;
  value: Id;
  onChange: (id: Id) => void;
  testId?: string;
  chipTestId?: (id: Id) => string;
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="flex flex-wrap items-center gap-1.5 rounded-token bg-canvas p-1"
      data-testid={testId}
    >
      {chips.map((c, i) => {
        const active = c.id === value;
        return (
          <button
            key={c.id}
            type="button"
            role="tab"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(c.id)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight") {
                e.preventDefault();
                onChange(chips[(i + 1) % chips.length]!.id);
              } else if (e.key === "ArrowLeft") {
                e.preventDefault();
                onChange(chips[(i - 1 + chips.length) % chips.length]!.id);
              }
            }}
            className={cn(
              "inline-flex shrink-0 items-center gap-2 rounded-token px-3 py-1.5 text-[13px] transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
              active
                ? "border border-border-strong bg-surface font-semibold text-foreground shadow-sm"
                : "border border-transparent font-medium text-muted-foreground hover:bg-surface/60 hover:text-foreground",
            )}
            data-testid={chipTestId?.(c.id)}
          >
            <span
              aria-hidden
              className={cn(
                "h-1.5 w-1.5 shrink-0 rounded-full",
                active ? DOT[c.tone] : "bg-faint",
              )}
            />
            {c.label}
          </button>
        );
      })}
    </div>
  );
}
