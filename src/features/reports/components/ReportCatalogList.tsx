"use client";

import { FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  REPORT_CATEGORY_LABEL,
  REPORT_CATEGORY_ORDER,
  type ReportCategory,
  type ReportDescriptor,
} from "../types";

/**
 * FE-54 role-filtered catalog list. Grouped by SRS cluster; selecting an entry
 * calls `onSelect(descriptor)` — the parent decides whether to render inline
 * (this hub for a simple report) or route to the viewer (`descriptor.viewerRoute`).
 */
export function ReportCatalogList({
  reports,
  selected,
  onSelect,
}: {
  reports: ReportDescriptor[];
  selected: string | null;
  onSelect: (d: ReportDescriptor) => void;
}) {
  const grouped = groupByCategory(reports);
  return (
    <nav
      aria-label="Report catalog"
      className="space-y-4"
      data-testid="report-catalog-list"
    >
      {REPORT_CATEGORY_ORDER.map((cat) => {
        const list = grouped.get(cat);
        if (!list || list.length === 0) return null;
        return (
          <section key={cat} data-testid={`catalog-group-${cat}`}>
            <h3 className="mb-1 px-2 text-[10.5px] font-semibold uppercase tracking-[0.5px] text-muted-foreground">
              {REPORT_CATEGORY_LABEL[cat]}
            </h3>
            <ul className="space-y-0.5">
              {list.map((r) => {
                const active = selected === r.name;
                return (
                  <li key={r.name}>
                    <button
                      type="button"
                      onClick={() => onSelect(r)}
                      data-testid={`catalog-entry-${r.name}`}
                      data-active={active ? "true" : "false"}
                      className={cn(
                        "flex w-full items-start gap-2.5 rounded-token px-2.5 py-2 text-left transition-colors",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                        active
                          ? "bg-accent-soft"
                          : "hover:bg-muted",
                      )}
                    >
                      <FileText
                        className={cn(
                          "mt-0.5 h-4 w-4 shrink-0",
                          active ? "text-accent-ink" : "text-muted-foreground",
                        )}
                        aria-hidden
                      />
                      <span className="min-w-0">
                        <span
                          className={cn(
                            "block break-words text-[13px] font-semibold",
                            active ? "text-accent-ink" : "text-foreground",
                          )}
                        >
                          {r.title}
                        </span>
                        <span className="mt-0.5 block break-words text-[11.5px] text-muted-foreground">
                          {r.description}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </nav>
  );
}

function groupByCategory(reports: ReportDescriptor[]): Map<ReportCategory, ReportDescriptor[]> {
  const map = new Map<ReportCategory, ReportDescriptor[]>();
  for (const r of reports) {
    const list = map.get(r.category) ?? [];
    list.push(r);
    map.set(r.category, list);
  }
  return map;
}
