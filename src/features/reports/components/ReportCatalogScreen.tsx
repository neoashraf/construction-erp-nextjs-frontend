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
import {
  REPORT_CATEGORY_ORDER,
  type ReportCategory,
  type ReportDescriptor,
} from "../types";
import { ReportCatalogBrowse } from "./ReportCatalogBrowse";
import { FinancialStatementsScreen } from "../financial-statements/components/FinancialStatementsScreen";
import { HrReportsViewer } from "../hr/components/HrReportsViewer";
import { InventoryReportsViewer } from "../inventory/components/InventoryReportsViewer";
import { ProjectIpcViewer } from "../project-ipc/components/ProjectIpcViewer";
import { RequisitionCostControlView } from "../rcc/components/RequisitionCostControlView";
import { TrialBalanceLedgersViewer } from "../viewers/trial-balance-ledgers/components/TrialBalanceLedgersViewer";

/** Each report category is rendered inline by its own viewer (embedded mode). */
type EmbeddableViewer = ComponentType<{ embedded?: boolean; initialReport?: string }>;
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
  const [query, setQuery] = useState("");

  const reports = useMemo(() => catalog.data ?? [], [catalog.data]);
  // First non-empty category becomes the default tab; the tab follows the
  // selected report once one is picked.
  const firstCategory = useMemo<ReportCategory>(() => {
    const present = new Set(reports.map((r) => r.category));
    return REPORT_CATEGORY_ORDER.find((c) => present.has(c)) ?? "LEDGERS_REGISTERS";
  }, [reports]);
  const [category, setCategory] = useState<ReportCategory | null>(null);
  const activeCategory = category ?? selected?.category ?? firstCategory;

  function onSelect(d: ReportDescriptor) {
    setSelected(d);
    setCategory(d.category);
  }

  const SelectedViewer = selected ? CATEGORY_VIEWER[selected.category] : null;

  return (
    <div className="mx-auto max-w-[1400px] px-6 py-6" data-testid="report-catalog-screen">
      <Breadcrumb items={[{ label: "Reports" }]} />
      <div className="mb-4 mt-1 flex flex-wrap items-center gap-3">
        <h1 className="text-[23px] font-bold tracking-[-0.02em]" data-testid="reports-title">
          Reports
        </h1>
        <span className="inline-flex h-[23px] items-center gap-1.5 rounded-pill bg-muted px-2.5 text-[11.5px] font-semibold text-muted-foreground">
          <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-faint" />
          Read-only · no records created here
        </span>
        <label className="relative ml-auto flex h-9 w-[280px] items-center gap-2 rounded-token border border-border-strong bg-surface px-3 focus-within:border-accent focus-within:shadow-focus">
          <Search className="h-[15px] w-[15px] shrink-0 text-faint" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search reports…"
            aria-label="Search reports"
            data-testid="reports-search"
            suppressHydrationWarning
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
        {/* Catalog — top browse strip: category tabs + report chips. */}
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
          <Card className="px-4 pb-3 pt-2">
            <ReportCatalogBrowse
              reports={reports}
              selected={selected?.name ?? null}
              activeCategory={activeCategory}
              onCategoryChange={setCategory}
              onSelect={onSelect}
              query={query}
            />
          </Card>
        )}

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
            <SelectedViewer key={selected.name} embedded initialReport={selected.name} />
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
