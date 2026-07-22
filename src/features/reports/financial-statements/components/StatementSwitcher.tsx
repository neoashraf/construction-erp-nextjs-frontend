"use client";

import { cn } from "@/lib/utils";
import { type StatementTab } from "../types";

/**
 * FE-55 Profit & loss ⇄ Balance sheet switcher. Per the design this family uses
 * the **underline-tab** idiom (like the catalog category tabs) — the active tab
 * is bold dark text with a 2px lime underline; the inactive tab is muted. (The
 * other report viewers use the pill chip row; financial statements does not.)
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
      className="flex items-center gap-1 border-b border-border-strong"
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
              "-mb-px whitespace-nowrap border-b-2 px-3.5 pb-2.5 pt-2 text-[13px] transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
              active
                ? "border-accent font-bold text-foreground"
                : "border-transparent font-medium text-muted-foreground hover:text-foreground",
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
