"use client";

import { cn } from "@/lib/utils";
import { type StatementTab } from "../types";

/**
 * FE-55 tablist between Profit & Loss and Balance sheet (spec §3). Keyboard
 * navigation follows the standard tablist pattern via arrow keys; each tab has
 * a stable testid.
 */
const TABS: Array<{ id: StatementTab; label: string }> = [
  { id: "PNL", label: "Profit & loss" },
  { id: "BS", label: "Balance sheet" },
];

export function StatementSwitcher({
  value,
  onChange,
}: {
  value: StatementTab;
  onChange: (tab: StatementTab) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Financial statement"
      className="inline-flex rounded-token border border-border-strong bg-background p-1"
      data-testid="statement-switcher"
    >
      {TABS.map((t) => {
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
              if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
                e.preventDefault();
                onChange(t.id === "PNL" ? "BS" : "PNL");
              }
            }}
            className={cn(
              "rounded-token px-4 py-1.5 text-[13px] font-semibold transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
              active ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted",
            )}
            data-testid={`statement-tab-${t.id}`}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
