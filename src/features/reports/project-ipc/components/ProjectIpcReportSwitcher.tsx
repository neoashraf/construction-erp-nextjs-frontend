"use client";

import { cn } from "@/lib/utils";
import { type ProjectReportTab } from "../types";

/**
 * FE-57 five-report tablist (spec §3, §9). Keyboard-navigable per WAI-ARIA
 * tabs pattern. The `type-pill` conveys "as-of" vs "flow" so a reader can tell
 * at a glance which time control the active tab honours.
 */
interface TabDef {
  id: ProjectReportTab;
  label: string;
  pill: { text: string; tone: "violet" | "blue" | "amber" };
}
const TABS: TabDef[] = [
  { id: "PROJECT_PNL", label: "Project P&L", pill: { text: "Flow · range", tone: "blue" } },
  { id: "IPC_BILLING", label: "IPC report", pill: { text: "Flow · range", tone: "blue" } },
  { id: "OUTSTANDING", label: "Outstanding", pill: { text: "Balance · as-of", tone: "violet" } },
  {
    id: "MATERIAL_CONSUMPTION",
    label: "Material consumption vs budget",
    pill: { text: "Flow · range", tone: "amber" },
  },
  { id: "LABOUR_COST", label: "Labour cost", pill: { text: "Flow · range", tone: "amber" } },
];

const PILL: Record<"violet" | "blue" | "amber", string> = {
  violet: "bg-violet-soft text-violet",
  blue: "bg-info-soft text-info-ink",
  amber: "bg-warning-soft text-warning-ink",
};

export function ProjectIpcReportSwitcher({
  value,
  onChange,
}: {
  value: ProjectReportTab;
  onChange: (next: ProjectReportTab) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Project report"
      className="flex items-center gap-1 overflow-x-auto rounded-token border border-border-strong bg-background p-1"
      data-testid="pi-switcher"
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
            data-testid={`pi-tab-${t.id}`}
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
