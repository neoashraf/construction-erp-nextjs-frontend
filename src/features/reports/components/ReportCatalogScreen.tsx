"use client";

import { type ComponentType, useEffect, useMemo, useState } from "react";
import { AlertCircle, WifiOff, FileText } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useOnline } from "@/lib/hooks/use-online";
import { useReportCatalog } from "../hooks/useReportCatalog";
import {
  REPORT_CATEGORY_ORDER,
  type ReportCategory,
  type ReportDescriptor,
} from "../types";
import { FinancialStatementsScreen } from "../financial-statements/components/FinancialStatementsScreen";
import { HrReportsViewer } from "../hr/components/HrReportsViewer";
import { InventoryReportsViewer } from "../inventory/components/InventoryReportsViewer";
import { ProjectIpcViewer } from "../project-ipc/components/ProjectIpcViewer";
import { RequisitionCostControlView } from "../rcc/components/RequisitionCostControlView";
import { TrialBalanceLedgersViewer } from "../viewers/trial-balance-ledgers/components/TrialBalanceLedgersViewer";

/** Each report category is rendered inline by its own viewer (embedded mode). */
type EmbeddableViewer = ComponentType<{
  embedded?: boolean;
  initialReport?: string;
  /** Fired when the viewer's own switcher changes the active report, so the hub
   *  can keep the breadcrumb in sync. Carries the report's display label because
   *  the catalog list may not include every sibling report (mock/partial rosters). */
  onReportChange?: (reportName: string, reportLabel: string) => void;
}>;
const CATEGORY_VIEWER: Record<ReportCategory, EmbeddableViewer> = {
  LEDGERS_REGISTERS: TrialBalanceLedgersViewer,
  FINANCIAL_STATEMENTS: FinancialStatementsScreen,
  PROJECT_IPC: ProjectIpcViewer,
  INVENTORY: InventoryReportsViewer,
  REQUISITION_COST_CONTROL: RequisitionCostControlView,
  HR: HrReportsViewer,
};

/**
 * FE-54 `/reports` hub — a single-page runner: the catalog (category tabs + report
 * chips) on top, and the selected report's viewer rendered INLINE below (embedded,
 * so it drops its own page chrome). Picking a chip opens that report's parameters +
 * result right here — no navigation. Read-only: no post/edit/delete anywhere.
 */
export function ReportCatalogScreen() {
  const online = useOnline();
  const catalog = useReportCatalog();
  const [selected, setSelected] = useState<ReportDescriptor | null>(null);
  // The active report's display label for the breadcrumb — set when a report is
  // opened, and kept fresh when the embedded viewer switches report internally.
  const [activeLabel, setActiveLabel] = useState<string | null>(null);

  const reports = useMemo(() => catalog.data ?? [], [catalog.data]);
  // First non-empty category becomes the default tab; the tab follows the
  // selected report once one is picked.
  const firstCategory = useMemo<ReportCategory>(() => {
    const present = new Set(reports.map((r) => r.category));
    return REPORT_CATEGORY_ORDER.find((c) => present.has(c)) ?? "LEDGERS_REGISTERS";
  }, [reports]);
  const activeCategory = selected?.category ?? firstCategory;

  // The embedded viewer switched report via its own chip row — update the
  // breadcrumb label. Uses the label the viewer passes (the catalog roster may
  // not list every sibling report), and syncs `selected` when it is listed.
  function onReportChange(reportName: string, reportLabel: string) {
    setActiveLabel(reportLabel);
    setSelected((prev) => reports.find((r) => r.name === reportName) ?? prev);
  }

  // First load: open the default category's viewer immediately (no idle state).
  useEffect(() => {
    if (selected || reports.length === 0) return;
    const first = reports.find((r) => r.category === activeCategory) ?? null;
    setSelected(first);
    if (first) setActiveLabel(first.title);
  }, [selected, reports, activeCategory]);

  const SelectedViewer = selected ? CATEGORY_VIEWER[selected.category] : null;
  // Prefer the label the embedded viewer reported (survives switches to reports
  // the catalog roster doesn't list); fall back to the selected descriptor.
  const breadcrumbReport = activeLabel ?? selected?.title ?? null;

  return (
    <div className="mx-auto max-w-[1400px] px-6 py-6" data-testid="report-catalog-screen">
      {/* Breadcrumb tracks the open report so it updates as chips are switched. */}
      <Breadcrumb
        items={
          breadcrumbReport
            ? [{ label: "Reports", href: "/reports" }, { label: breadcrumbReport }]
            : [{ label: "Reports" }]
        }
      />
      <div className="mb-4 mt-1 flex flex-wrap items-center gap-3">
        <h1 className="text-[23px] font-bold tracking-[-0.02em]" data-testid="reports-title">
          Reports
        </h1>
        <span className="inline-flex h-[23px] items-center gap-1.5 rounded-pill bg-muted px-2.5 text-[11.5px] font-semibold text-muted-foreground">
          <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-faint" />
          Read-only · no records created here
        </span>
      </div>

      {!online && (
        <Alert
          tone="warning"
          title="You're offline."
          className="mb-4"
          data-testid="reports-offline"
        >
          <span className="text-[12.5px]">
            <WifiOff className="mr-1 inline h-3.5 w-3.5" aria-hidden />
            Run and Export are disabled until you reconnect.
          </span>
        </Alert>
      )}

      <div className="space-y-4">
        {catalog.isLoading ? (
          <Card className="space-y-3 px-4 py-3" data-testid="catalog-loading">
            <Skeleton className="h-8 w-full max-w-md" />
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-32" />
              ))}
            </div>
          </Card>
        ) : catalog.isError ? (
          <Card className="p-6" data-testid="catalog-error">
            <EmptyState
              icon={AlertCircle}
              title="Couldn't load the report list."
              action={
                <Button size="sm" onClick={() => catalog.refetch()} data-testid="catalog-retry">
                  Retry
                </Button>
              }
            />
          </Card>
        ) : null}

        <section className="min-w-0" data-testid="report-runner">
          {!selected || !SelectedViewer ? (
            <Card className="p-10" data-testid="reports-idle">
              <EmptyState
                icon={FileText}
                title="Select a report to begin."
                description="Pick any report from the catalog. Its parameters open here — set them, then Run to render on-screen or export to Excel / PDF."
              />
            </Card>
          ) : (
            // Keyed by report name so switching chips re-opens the viewer on the
            // right sub-report. The viewer runs + renders its own result inline.
            <SelectedViewer
              key={selected.category}
              embedded
              initialReport={selected.name}
              onReportChange={onReportChange}
            />
          )}
        </section>

        <p className="pt-1 text-[11.5px] leading-relaxed text-faint" data-testid="reports-caption">
          Default: the catalog is role-filtered — a report the caller can&apos;t run is absent, not
          shown-then-403&apos;d.
        </p>
      </div>
    </div>
  );
}
