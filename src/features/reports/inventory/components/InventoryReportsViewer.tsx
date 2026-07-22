"use client";

import { useMemo, useState } from "react";
import { Ban, WifiOff } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ReportViewerHeader, type ReportScopeTone } from "../../components/ReportViewerHeader";
import { asApiError } from "@/lib/api/errors";
import { useOnline } from "@/lib/hooks/use-online";
import { useAuthenticatedUser } from "@/providers/session-provider";
import { ReportExportControl } from "../../components/ReportExportControl";
import { ReportParameterPanel } from "../../components/ReportParameterPanel";
import { type ReportDescriptor, type ReportParams } from "../../types";
import {
  REPORT_NAME,
  type InventoryReportTab,
  type LowStockRow,
  type LowStockTotals,
  type StockTransferRow,
  type StockTransferTotals,
  type StockValuationRow,
  type StockValuationTotals,
} from "../types";
import {
  breadcrumbFor,
  subtitleFor,
  useInventoryReport,
} from "../hooks/useInventoryReport";
import { InventoryFilters } from "./InventoryFilters";
import { InventoryReportsSwitcher } from "./InventoryReportsSwitcher";
import { LowStockTable } from "./LowStockTable";
import { StockTransferSummaryTable } from "./StockTransferSummaryTable";
import { StockValuationTable } from "./StockValuationTable";

/**
 * FE-58 `/reports/inventory` — three inventory reports behind one switcher
 * (FR-RPT-021/022/023). Mounts the shared FE-54 parameter panel + Export
 * verbatim; the per-report table + report-specific filters live here.
 * Stock valuation + Low-stock are as-of; Transfer summary is a date range.
 */
/** Reverse REPORT_NAME → tab so the hub can open this viewer on a chosen report. */
function reportToTab(name?: string): InventoryReportTab {
  const found = (Object.entries(REPORT_NAME) as [InventoryReportTab, string][]).find(
    ([, n]) => n === name,
  );
  return found?.[0] ?? "STOCK_VALUATION";
}

export function InventoryReportsViewer({
  embedded = false,
  initialReport,
  onReportChange,
}: {
  embedded?: boolean;
  initialReport?: string;
  onReportChange?: (reportName: string, reportLabel: string) => void;
} = {}) {
  const online = useOnline();
  const user = useAuthenticatedUser();
  const [tab, setTab] = useState<InventoryReportTab>(() => reportToTab(initialReport));
  const [params, setParams] = useState<ReportParams>({
    financialYearId: user.financialYearId ?? "",
  });
  const [ran, setRan] = useState(false);

  const descriptor: ReportDescriptor = useMemo(() => buildDescriptor(tab), [tab]);

  const effectiveParams = useMemo<ReportParams>(() => {
    const p: ReportParams = { ...params };
    if (tab === "TRANSFER_SUMMARY") {
      p.asOf = null;
      p.periodId = null;
    } else {
      p.dateFrom = null;
      p.dateTo = null;
    }
    return p;
  }, [params, tab]);

  const query = useInventoryReport(tab, effectiveParams, ran);

  function onTabChange(next: InventoryReportTab) {
    setRan(false);
    setTab(next);
    onReportChange?.(REPORT_NAME[next], breadcrumbFor(next));
  }

  function onRun(p: ReportParams) {
    if (tab === "TRANSFER_SUMMARY" && p.dateFrom && p.dateTo && p.dateFrom > p.dateTo) {
      // Panel's own schema already catches this — keep as a defensive block.
      return;
    }
    setParams(p);
    setRan(true);
  }

  const err = query.error ? asApiError(query.error) : null;
  const forbidden = err?.status === 403;
  const dateError =
    tab === "TRANSFER_SUMMARY" && params.dateFrom && params.dateTo && params.dateFrom > params.dateTo
      ? "'Date from' must be before 'Date to'."
      : null;

  // Scope pill: stock valuation + low-stock are as-of balance reports (violet);
  // the transfer summary is a date-range flow report (blue).
  const scopeLabel = tab === "TRANSFER_SUMMARY" ? "Flow · date range" : "Balance · as-of";
  const scopeTone: ReportScopeTone = tab === "TRANSFER_SUMMARY" ? "blue" : "violet";

  return (
    <div className={embedded ? "" : "mx-auto max-w-[1400px] px-6 py-6"} data-testid="iv-viewer">
      {!embedded && (
        <ReportViewerHeader
          breadcrumbLabel={breadcrumbFor(tab)}
          title={breadcrumbFor(tab)}
          scopeLabel={scopeLabel}
          scopeTone={scopeTone}
          titleTestId="iv-title"
        />
      )}

      <InventoryReportsSwitcher value={tab} onChange={onTabChange} />

      {!online && (
        <Alert
          tone="warning"
          title="You're offline. This report can't be loaded right now."
          className="mt-4"
          data-testid="iv-offline"
        >
          <span className="text-[12.5px]">
            <WifiOff className="mr-1 inline h-3.5 w-3.5" aria-hidden />
            Parameters are preserved — try again when you reconnect.
          </span>
        </Alert>
      )}

      <div className="mt-4 space-y-3">
        <ReportParameterPanel
          descriptor={descriptor}
          value={params}
          onChange={setParams}
          onRun={onRun}
          running={query.isFetching}
          disabled={!online}
        />

        <InventoryFilters
          tab={tab}
          value={params}
          onChange={setParams}
          dateError={dateError}
        />
      </div>

      <Card className="mt-4 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
          <div>
            <h2 className="text-[14px] font-bold text-foreground">{breadcrumbFor(tab)}</h2>
            <p className="mt-0.5 text-[11.5px] text-muted-foreground">{subtitleFor(tab)}</p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <ReportExportControl
              reportName={REPORT_NAME[tab]}
              params={effectiveParams}
              disabled={!online || forbidden}
            />
          </div>
        </div>

        {forbidden ? (
          <div className="p-8" data-testid="iv-forbidden">
            <EmptyState
              icon={Ban}
              title="You don't have access to this project."
              description="Ask an administrator to add this project to your assignments and try again."
            />
          </div>
        ) : (
          <BodyForTab
            tab={tab}
            data={query.data}
            isLoading={query.isFetching}
            isError={query.isError && !forbidden}
            onRetry={() => query.refetch()}
          />
        )}
      </Card>
    </div>
  );
}

function BodyForTab({
  tab,
  data,
  isLoading,
  isError,
  onRetry,
}: {
  tab: InventoryReportTab;
  data: ReturnType<typeof useInventoryReport>["data"];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}) {
  const meta = data?.meta;
  const rows = data?.rows;
  const generatedAt = meta?.generatedAt;

  if (tab === "STOCK_VALUATION") {
    const t = (meta?.totals ?? null) as Partial<StockValuationTotals> | null;
    const totals: StockValuationTotals | null = t
      ? { totalValue: t.totalValue ?? "0.0000" }
      : null;
    return (
      <StockValuationTable
        rows={rows as StockValuationRow[] | undefined}
        totals={totals}
        generatedAt={generatedAt}
        isLoading={isLoading}
        isError={isError}
        onRetry={onRetry}
      />
    );
  }

  if (tab === "LOW_STOCK") {
    const t = (meta?.totals ?? null) as Partial<LowStockTotals> | null;
    const totals: LowStockTotals | null = t
      ? {
          totalValue: t.totalValue ?? "0.0000",
          breachedCount: t.breachedCount ?? 0,
        }
      : null;
    return (
      <LowStockTable
        rows={rows as LowStockRow[] | undefined}
        totals={totals}
        generatedAt={generatedAt}
        isLoading={isLoading}
        isError={isError}
        onRetry={onRetry}
      />
    );
  }

  const t = (meta?.totals ?? null) as Partial<StockTransferTotals> | null;
  const totals: StockTransferTotals | null = t
    ? { totalValueMoved: t.totalValueMoved ?? "0.0000" }
    : null;
  return (
    <StockTransferSummaryTable
      rows={rows as StockTransferRow[] | undefined}
      totals={totals}
      generatedAt={generatedAt}
      isLoading={isLoading}
      isError={isError}
      onRetry={onRetry}
    />
  );
}

/**
 * Build a synthetic FE-54 descriptor per tab — panel reads `supportsAsOf` /
 * `supportsDateRange` off it. `projectScoped: false` because the shared panel
 * hides the Project field for inventory (PM's assigned-godown scoping is
 * server-side); the shared FY control still shows.
 */
function buildDescriptor(tab: InventoryReportTab): ReportDescriptor {
  return {
    name: REPORT_NAME[tab],
    title: "",
    description: "",
    category: "INVENTORY",
    viewerRoute: "/reports/inventory",
    requiredPermission: "reports",
    parameters: [],
    projectScoped: false,
    supportsAsOf: tab !== "TRANSFER_SUMMARY",
    supportsDateRange: tab === "TRANSFER_SUMMARY",
  };
}
