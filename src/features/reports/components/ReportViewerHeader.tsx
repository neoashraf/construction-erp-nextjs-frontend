"use client";

import { type ReactNode } from "react";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { cn } from "@/lib/utils";

/**
 * Shared standalone-viewer header — matches the design's per-report header: a
 * `Reports › <report>` breadcrumb, the **active report name** as the H1 (not the
 * category name), a scope/time-mode pill next to it, and a right-aligned
 * `Read-only · exportable` note. Rendered only in standalone (`!embedded`) mode;
 * inside the `/reports` hub the catalog owns the page H1, so viewers pass their
 * own header through this component behind their own `embedded` guard.
 *
 * `scopeTone` colours the pill dot to echo the chip-row meaning-dots:
 *   violet = balance / as-of · blue = flow / date range · amber = budget variance.
 */
export type ReportScopeTone = "violet" | "blue" | "amber";

const PILL: Record<ReportScopeTone, string> = {
  violet: "bg-violet-soft text-violet",
  blue: "bg-info-soft text-info-ink",
  amber: "bg-warning-soft text-warning-ink",
};
const DOT: Record<ReportScopeTone, string> = {
  violet: "bg-violet",
  blue: "bg-info",
  amber: "bg-warning",
};

export function ReportViewerHeader({
  breadcrumbLabel,
  title,
  scopeLabel,
  scopeTone,
  titleTestId = "report-viewer-title",
  extra,
}: {
  breadcrumbLabel: string;
  title: string;
  scopeLabel: string;
  scopeTone: ReportScopeTone;
  /** Override for the H1 testid so per-viewer tests keep their existing selector. */
  titleTestId?: string;
  /** Optional trailing chip(s) rendered after the scope pill (e.g. a PM-scope badge). */
  extra?: ReactNode;
}) {
  return (
    <>
      <Breadcrumb items={[{ label: "Reports", href: "/reports" }, { label: breadcrumbLabel }]} />
      <div className="mb-4 mt-1 flex flex-wrap items-center gap-3">
        <h1 className="text-[23px] font-bold tracking-[-0.02em]" data-testid={titleTestId}>
          {title}
        </h1>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-pill px-2.5 py-0.5 text-[11.5px] font-semibold",
            PILL[scopeTone],
          )}
          data-testid="report-scope-pill"
        >
          <span aria-hidden className={cn("h-1.5 w-1.5 rounded-full", DOT[scopeTone])} />
          {scopeLabel}
        </span>
        {extra}
        <span className="ml-auto inline-flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
          <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-faint" />
          Read-only · exportable
        </span>
      </div>
    </>
  );
}
