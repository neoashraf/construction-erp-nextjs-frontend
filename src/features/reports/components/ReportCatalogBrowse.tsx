"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  REPORT_CATEGORY_ORDER,
  type ReportCategory,
  type ReportDescriptor,
} from "../types";

/**
 * FE-54 browse-view catalog — category tabs + report chips (matches the
 * `Reports.dc.html` default "browse" layout). Selecting a chip calls
 * `onSelect(descriptor)`; the parent decides inline-vs-viewer routing.
 * `activeCategory` is controlled so the tab follows the selected report.
 */

/** Short tab labels — the design collapses the long category names to fit one row. */
const CATEGORY_TAB_LABEL: Record<ReportCategory, string> = {
  LEDGERS_REGISTERS: "Ledgers & registers",
  FINANCIAL_STATEMENTS: "Financial statements",
  PROJECT_IPC: "Project",
  INVENTORY: "Inventory",
  REQUISITION_COST_CONTROL: "Cost control",
  HR: "HR",
};

/** Balance reports use an as-of/period (violet); flow reports use a date range (blue). */
function chipTone(r: ReportDescriptor): "balance" | "flow" {
  return r.supportsAsOf && !r.supportsDateRange ? "balance" : "flow";
}

export function ReportCatalogBrowse({
  reports,
  selected,
  activeCategory,
  onCategoryChange,
  onSelect,
  query,
}: {
  reports: ReportDescriptor[];
  selected: string | null;
  activeCategory: ReportCategory;
  onCategoryChange: (c: ReportCategory) => void;
  onSelect: (d: ReportDescriptor) => void;
  query: string;
}) {
  const byCategory = useMemo(() => groupByCategory(reports), [reports]);

  // Which categories actually have reports (role-filtered) → those become tabs.
  const tabs = REPORT_CATEGORY_ORDER.filter((c) => (byCategory.get(c)?.length ?? 0) > 0);

  const q = query.trim().toLowerCase();
  // Chips only appear while searching — results span categories, so they're the
  // picker. Without a query, clicking a category tab opens its viewer directly
  // (the viewer's own switcher handles multi-report categories), so no chip row.
  const chips = q ? reports.filter((r) => r.title.toLowerCase().includes(q)) : [];

  return (
    <div data-testid="report-catalog-browse">
      {/* category tabs */}
      <div
        role="tablist"
        aria-label="Report categories"
        className="no-scrollbar flex gap-0.5 overflow-x-auto border-b border-border-strong"
      >
        {tabs.map((c) => {
          const active = !q && c === activeCategory;
          return (
            <button
              key={c}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onCategoryChange(c)}
              data-testid={`catalog-tab-${c}`}
              className={cn(
                "-mb-px whitespace-nowrap border-b-2 px-3.5 pb-2.5 pt-2.5 text-[13px] transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                active
                  ? "border-accent font-bold text-foreground"
                  : "border-transparent font-medium text-muted-foreground hover:text-foreground",
              )}
            >
              {CATEGORY_TAB_LABEL[c]}
            </button>
          );
        })}
      </div>

      {/* report chips — only while searching (results span categories) */}
      {q && chips.length === 0 ? (
        <p className="mt-3 text-[12.5px] text-muted-foreground">
          No reports match “{query.trim()}”.
        </p>
      ) : chips.length === 0 ? null : (
        <div className="mt-3 flex flex-wrap gap-2">
          {chips.map((r) => {
            const active = selected === r.name;
            const tone = chipTone(r);
            return (
              <button
                key={r.name}
                type="button"
                onClick={() => onSelect(r)}
                data-testid={`catalog-chip-${r.name}`}
                data-active={active ? "true" : "false"}
                title={r.description}
                className={cn(
                  "inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-token border px-3 text-[12.5px] transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                  active
                    ? "border-accent bg-accent-soft font-semibold text-accent-ink"
                    : "border-border-strong bg-surface font-medium text-foreground hover:border-border-hover hover:bg-surface-2",
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "h-1.5 w-1.5 shrink-0 rounded-full",
                    tone === "balance" ? "bg-violet" : "bg-info",
                  )}
                />
                {r.title}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function groupByCategory(
  reports: ReportDescriptor[],
): Map<ReportCategory, ReportDescriptor[]> {
  const map = new Map<ReportCategory, ReportDescriptor[]>();
  for (const r of reports) {
    const list = map.get(r.category) ?? [];
    list.push(r);
    map.set(r.category, list);
  }
  return map;
}
