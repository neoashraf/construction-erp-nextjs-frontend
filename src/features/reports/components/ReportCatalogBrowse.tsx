"use client";

import { cn } from "@/lib/utils";
import { CATEGORY_ROSTER, type RosterTone } from "../catalog-roster";
import {
  REPORT_CATEGORY_ORDER,
  REPORT_CATEGORY_TAB_LABEL,
  type ReportCategory,
} from "../types";

/**
 * FE-54 catalog browse strip (`Reports.dc.html` — "TOP BROWSE STRIP"). A single
 * card holding two rows — and only two, since the embedded viewers suppress their
 * own chip row in favour of this one:
 *   1. category **tabs** — underline tabs, active = bold ink text + a 2px lime
 *      underline that sits on the row's bottom hairline (`margin-bottom:-1px`).
 *   2. report **chips** for the active tab — pill + leading meaning-dot; the open
 *      report's chip is the lime `accent-soft` state.
 * Picking a chip calls `onSelect(name)`; picking a tab calls `onCategoryChange`.
 *
 * Chips come from the static `CATEGORY_ROSTER` so the row lists EVERY report in
 * the category the way the design draws it, rather than only the ones the catalog
 * API returned. `permitted` still gates them: a report the caller can't run is
 * dropped, and a category with nothing permitted gets no tab.
 */

/** Dot colour per report kind — matches each viewer's own switcher. */
const DOT: Record<RosterTone, string> = {
  violet: "bg-violet",
  blue: "bg-info",
  amber: "bg-warning",
};

export function ReportCatalogBrowse({
  permitted,
  selected,
  activeCategory,
  onSelect,
  onCategoryChange,
  query,
}: {
  /** Report names the caller may run (from the role-filtered catalog API). */
  permitted: ReadonlySet<string>;
  selected: string | null;
  activeCategory: ReportCategory;
  onSelect: (reportName: string, category: ReportCategory) => void;
  onCategoryChange: (c: ReportCategory) => void;
  query: string;
}) {
  const q = query.trim().toLowerCase();
  const inCategory = (c: ReportCategory) =>
    CATEGORY_ROSTER[c].filter((r) => permitted.has(r.name));
  // Only categories with at least one permitted report get a tab.
  const tabs = REPORT_CATEGORY_ORDER.filter((c) => inCategory(c).length > 0);
  // Searching spans every category (results are the picker); otherwise the chip
  // row is scoped to the active tab, per the design's browse strip.
  const chips = q
    ? REPORT_CATEGORY_ORDER.flatMap((c) =>
        inCategory(c).map((r) => ({ ...r, category: c })),
      ).filter((r) => r.title.toLowerCase().includes(q))
    : inCategory(activeCategory).map((r) => ({ ...r, category: activeCategory }));

  return (
    <div
      className="rounded-card border border-border bg-surface px-3.5 pb-3 pt-0.5 shadow-sm"
      data-testid="report-catalog-browse"
    >
      {/* category tabs — one scrolling row at every width (the design keeps the
          strip on a single line at 768 too). The bottom hairline is painted as a
          background line rather than a `border-b`, because a border on a scroll
          container would clip the active tab's `-mb-px` lime underline. */}
      <div
        role="tablist"
        aria-label="Report categories"
        className="mt-2 flex gap-0.5 overflow-x-auto bg-[linear-gradient(to_top,var(--color-border-strong)_1px,transparent_1px)]"
      >
        {tabs.map((c, i) => {
          const active = c === activeCategory;
          return (
            <button
              key={c}
              type="button"
              role="tab"
              aria-selected={active}
              tabIndex={active ? 0 : -1}
              onClick={() => onCategoryChange(c)}
              onKeyDown={(e) => {
                if (e.key === "ArrowRight") {
                  e.preventDefault();
                  onCategoryChange(tabs[(i + 1) % tabs.length]!);
                } else if (e.key === "ArrowLeft") {
                  e.preventDefault();
                  onCategoryChange(tabs[(i - 1 + tabs.length) % tabs.length]!);
                }
              }}
              data-testid={`catalog-tab-${c}`}
              className={cn(
                "whitespace-nowrap border-b-2 px-3.5 pb-2.5 pt-2.5 text-[13px] transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                active
                  ? "border-accent font-bold text-foreground"
                  : "border-transparent font-medium text-muted-foreground hover:text-foreground",
              )}
            >
              {REPORT_CATEGORY_TAB_LABEL[c]}
            </button>
          );
        })}
      </div>

      {/* report chips for the active tab (or the search hits) */}
      {q && chips.length === 0 ? (
        <p className="mt-3 text-[12.5px] text-muted-foreground">
          No reports match “{query.trim()}”.
        </p>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          {chips.map((r) => {
            const active = selected === r.name;
            return (
              <button
                key={r.name}
                type="button"
                onClick={() => onSelect(r.name, r.category)}
                data-testid={`catalog-chip-${r.name}`}
                data-active={active ? "true" : "false"}
                className={cn(
                  "inline-flex h-8 items-center gap-[7px] whitespace-nowrap rounded-token border px-3 text-[12.5px] transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                  active
                    ? "border-accent bg-accent-soft font-semibold text-accent-ink"
                    : "border-border-strong bg-surface font-medium text-foreground hover:border-border-hover hover:bg-surface-2",
                )}
              >
                <span
                  aria-hidden
                  className={cn("h-1.5 w-1.5 shrink-0 rounded-full", DOT[r.tone])}
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
