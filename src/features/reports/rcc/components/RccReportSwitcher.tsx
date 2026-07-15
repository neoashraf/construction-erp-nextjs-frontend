"use client";

import { cn } from "@/lib/utils";
import { type RccReportTab } from "../types";

const TABS: Array<{ id: RccReportTab; label: string; pill: { text: string; tone: "blue" } }> = [
  { id: "REQUISITION_VS_ISSUE", label: "Requisition vs issue", pill: { text: "Flow · date range", tone: "blue" } },
  { id: "COST_CENTRE_VARIANCE", label: "Cost-centre variance", pill: { text: "Flow · date range", tone: "blue" } },
];

const PILL = { blue: "bg-info-soft text-info-ink" };

export function RccReportSwitcher({
  value,
  onChange,
}: {
  value: RccReportTab;
  onChange: (next: RccReportTab) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Requisition & cost-control report"
      className="flex items-center gap-1 overflow-x-auto rounded-token border border-border-strong bg-background p-1"
      data-testid="rcc-switcher"
    >
      {TABS.map((t, i) => {
        const active = t.id === value;
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(t.id)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight") {
                e.preventDefault();
                onChange(TABS[(i + 1) % TABS.length]!.id);
              } else if (e.key === "ArrowLeft") {
                e.preventDefault();
                onChange(TABS[(i - 1 + TABS.length) % TABS.length]!.id);
              }
            }}
            className={cn(
              "flex shrink-0 items-center gap-2 rounded-token px-3 py-1.5 text-[13px] font-semibold transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
              active ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted",
            )}
            data-testid={`rcc-tab-${t.id}`}
          >
            {t.label}
            <span
              className={cn(
                "rounded-pill px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-wide",
                active ? "bg-background/25 text-background" : PILL[t.pill.tone],
              )}
              aria-hidden
            >
              {t.pill.text}
            </span>
          </button>
        );
      })}
    </div>
  );
}
