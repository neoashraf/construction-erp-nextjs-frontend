"use client";

import { type ComponentType, useMemo, useState } from "react";
import { AlertCircle, WifiOff, FileText, Search } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useOnline } from "@/lib/hooks/use-online";
import { useReportCatalog } from "../hooks/useReportCatalog";
import { ReportCatalogBrowse } from "./ReportCatalogBrowse";
import { CATEGORY_ROSTER } from "../catalog-roster";
import { REPORT_CATEGORY_ORDER, type ReportCategory } from "../types";

/** The report currently open in the inline runner. */
interface OpenReport {
  name: string;
  category: ReportCategory;
}
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
  // The open report, as {name, category} — a roster chip is not guaranteed to have
  // a catalog descriptor, and the viewer only needs the name to open on.
  const [selected, setSelected] = useState<OpenReport | null>(null);
  // The active report's display label for the breadcrumb — set when a report is
  // opened, and kept fresh when the embedded viewer switches report internally.
  const [activeLabel, setActiveLabel] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  // A tab the user picked explicitly. Null = follow the open report's category,
  // so the strip stays in sync when a viewer switches report on its own.
  const [tabOverride, setTabOverride] = useState<ReportCategory | null>(null);
  // Bumped only when a catalog chip opens a report, to force the viewer to remount
  // and re-read `initialReport`. See `onSelectReport` / `onReportChange`.
  const [openKey, setOpenKey] = useState(0);

  const reports = useMemo(() => catalog.data ?? [], [catalog.data]);
  /** Report names the caller may run — the catalog API is role-filtered. */
  const permitted = useMemo(() => new Set(reports.map((r) => r.name)), [reports]);
  // First non-empty category becomes the default tab; the tab follows the
  // selected report once one is picked.
  const firstCategory = useMemo<ReportCategory>(() => {
    const present = new Set(reports.map((r) => r.category));
    return REPORT_CATEGORY_ORDER.find((c) => present.has(c)) ?? "LEDGERS_REGISTERS";
  }, [reports]);
  const activeCategory = tabOverride ?? selected?.category ?? firstCategory;

  // A viewer changed report internally — keep the breadcrumb and the lit chip in
  // sync WITHOUT bumping `openKey`: the viewer has already moved itself to that
  // sub-report, and remounting it here would undo the switch it just made.
  function onReportChange(reportName: string, reportLabel: string) {
    setActiveLabel(reportLabel);
    setSelected((prev) => (prev ? { ...prev, name: reportName } : prev));
    // The viewer drove this, so hand the tab back to "follow the open report".
    setTabOverride(null);
  }

  /** A catalog chip was picked — open that report in its category's viewer. */
  function onSelectReport(reportName: string, category: ReportCategory) {
    setSelected({ name: reportName, category });
    setActiveLabel(
      CATEGORY_ROSTER[category].find((r) => r.name === reportName)?.title ?? null,
    );
    // Bump the mount key so the viewer re-reads `initialReport` (it only consults
    // it in its tab's useState initialiser), even for a sibling in the same category.
    setOpenKey((k) => k + 1);
    setTabOverride(null);
    setQuery("");
  }

  // No auto-open: the design's default artboard is "catalog loaded · no report
  // selected · right pane shows the prompt". A report opens only on a chip click.
  const SelectedViewer = selected ? CATEGORY_VIEWER[selected.category] : null;
  // Prefer the label the embedded viewer reported (it knows about sub-reports the
  // roster doesn't chip); fall back to the roster title for the open report.
  const breadcrumbReport =
    activeLabel ??
    (selected
      ? CATEGORY_ROSTER[selected.category].find((r) => r.name === selected.name)?.title ?? null
      : null);

  return (
    <div className="mx-auto max-w-[1400px] px-6 py-6" data-testid="report-catalog-screen">
      {/* The catalog root shows a bare `Reports` crumb; opening a report extends
          it to `Reports / <report>` (design: "breadcrumb (catalog root, or …)"). */}
      <Breadcrumb
        items={
          breadcrumbReport
            ? [{ label: "Reports", href: "/reports" }, { label: breadcrumbReport }]
            : [{ label: "Reports" }]
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-3.5">
        <h1 className="text-[23px] font-bold tracking-[-0.02em]" data-testid="reports-title">
          Reports
        </h1>
        <span className="inline-flex h-[23px] items-center gap-1.5 rounded-pill bg-muted px-2.5 text-[11.5px] font-semibold text-muted-foreground">
          <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-faint" />
          {/* The tablet frame drops the qualifier to keep the row on one line. */}
          Read-only<span className="hidden lg:inline"> · no records created here</span>
        </span>
        {/* Catalog search — the tablet (768) and mobile frames drop it, giving the
            row to the title + badge only; it returns on the desktop frame. */}
        <label className="ml-auto hidden h-9 w-[280px] items-center gap-[9px] rounded-token border border-border-strong bg-surface px-3 focus-within:border-accent focus-within:shadow-[var(--focus-ring)] lg:flex">
          <Search className="h-[15px] w-[15px] shrink-0 text-faint" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search reports…"
            aria-label="Search reports"
            data-testid="reports-search"
            className="min-w-0 flex-1 bg-transparent text-[13px] text-foreground outline-none placeholder:text-faint"
          />
        </label>
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
        ) : (
          <ReportCatalogBrowse
            permitted={permitted}
            selected={selected?.name ?? null}
            activeCategory={activeCategory}
            onSelect={onSelectReport}
            onCategoryChange={setTabOverride}
            query={query}
          />
        )}

        <section className="min-w-0" data-testid="report-runner">
          {!selected || !SelectedViewer ? (
            // Design: the idle pane is a tall card with the prompt centred inside
            // it — no dashed inner frame, and a 58px rounded-square icon tile.
            <Card
              className="flex min-h-[560px] items-center justify-center"
              data-testid="reports-idle"
            >
              <div className="flex max-w-[420px] flex-col items-center px-10 py-10 text-center">
                <div className="grid h-[58px] w-[58px] place-items-center rounded-[14px] bg-muted text-faint">
                  <FileText className="h-[26px] w-[26px]" aria-hidden />
                </div>
                <p className="mt-4 text-base font-bold text-foreground">
                  Select a report to begin.
                </p>
                <p className="mt-[7px] text-[13px] leading-[1.5] text-muted-foreground">
                  Pick any report from the catalog. Its parameters open here — set them, then Run
                  to render on-screen or export to Excel / PDF.
                </p>
              </div>
            </Card>
          ) : (
            // Keyed by `openKey` (bumped per chip click), not by report name: the
            // viewers read `initialReport` only in their tab's useState initialiser,
            // so a sibling chip in the same category must remount them — while a
            // viewer's OWN report change must not. The viewer runs + renders inline.
            <SelectedViewer
              key={openKey}
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
