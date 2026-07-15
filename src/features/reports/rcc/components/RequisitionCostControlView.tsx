"use client";

import { useMemo, useState } from "react";
import { Ban, WifiOff } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { asApiError } from "@/lib/api/errors";
import { useOnline } from "@/lib/hooks/use-online";
import { useAuthenticatedUser } from "@/providers/session-provider";
import { ReportExportControl } from "../../components/ReportExportControl";
import { ReportParameterPanel } from "../../components/ReportParameterPanel";
import { type ReportDescriptor, type ReportParams } from "../../types";
import {
  REPORT_NAME,
  type CostCentreVarianceRow,
  type CostCentreVarianceTotals,
  type RccReportTab,
  type RequisitionVsIssueRow,
  type RequisitionVsIssueTotals,
} from "../types";
import {
  breadcrumbFor,
  subtitleFor,
  useRccReport,
} from "../hooks/useRccReport";
import { CostCentreVarianceTable } from "./CostCentreVarianceTable";
import { RccReportSwitcher } from "./RccReportSwitcher";
import { RequisitionVsIssueTable } from "./RequisitionVsIssueTable";
import { StatusFilterChips } from "./StatusFilterChips";

/**
 * FE-59 `/reports/requisition-cost-control` — two-report switcher over the
 * shared FE-54 panel + Export. Requisition vs issue is REQ's requested/issued
 * verbatim (variance = REQ's own derived value); cost-centre variance is CC's
 * classification verbatim (no client re-round or re-compute).
 */
export function RequisitionCostControlView() {
  const online = useOnline();
  const user = useAuthenticatedUser();
  const [tab, setTab] = useState<RccReportTab>("REQUISITION_VS_ISSUE");
  const [params, setParams] = useState<ReportParams>({
    financialYearId: user.financialYearId ?? "",
  });
  const [ran, setRan] = useState(false);

  const descriptor: ReportDescriptor = useMemo(() => buildDescriptor(tab), [tab]);
  const effectiveParams = useMemo<ReportParams>(() => ({ ...params, asOf: null, periodId: null }), [params]);
  const query = useRccReport(tab, effectiveParams, ran);

  function onTabChange(next: RccReportTab) {
    // Preserve project/CC/FY; reset each report's extras (requisition / status)
    // per spec §9.
    setParams((prev) => ({
      financialYearId: prev.financialYearId,
      projectId: prev.projectId ?? null,
      costCentreId: prev.costCentreId ?? null,
      dateFrom: prev.dateFrom ?? null,
      dateTo: prev.dateTo ?? null,
      extras: {},
    }));
    setRan(false);
    setTab(next);
  }

  function onRun(p: ReportParams) {
    setParams(p);
    setRan(true);
  }

  const err = query.error ? asApiError(query.error) : null;
  const forbidden = err?.status === 403;

  return (
    <div className="mx-auto max-w-[1400px] px-6 py-6" data-testid="rcc-viewer">
      <Breadcrumb
        items={[
          { label: "Reports", href: "/reports" },
          { label: breadcrumbFor(tab) },
        ]}
      />
      <div className="mb-4 mt-1 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[23px] font-bold tracking-[-0.02em]" data-testid="rcc-title">
            Requisition &amp; cost-control reports
          </h1>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Read-only — REQ &amp; CC figures rendered verbatim.
          </p>
        </div>
      </div>

      <RccReportSwitcher value={tab} onChange={onTabChange} />

      {!online && (
        <Alert
          tone="warning"
          title="You're offline. This report can't be loaded right now."
          className="mt-4"
          data-testid="rcc-offline"
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

        {tab === "COST_CENTRE_VARIANCE" && (
          <div className="rounded-card border border-border bg-background p-4" data-testid="rcc-ccv-filters">
            <StatusFilterChips value={params} onChange={setParams} />
          </div>
        )}
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
          <div className="p-8" data-testid="rcc-forbidden">
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
  tab: RccReportTab;
  data: ReturnType<typeof useRccReport>["data"];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}) {
  const meta = data?.meta;
  const rows = data?.rows;
  const generatedAt = meta?.generatedAt;

  if (tab === "REQUISITION_VS_ISSUE") {
    const t = (meta?.totals ?? null) as Partial<RequisitionVsIssueTotals> | null;
    const totals: RequisitionVsIssueTotals | null = t
      ? {
          lineCount: t.lineCount ?? 0,
          fullyIssued: t.fullyIssued ?? 0,
          outstanding: t.outstanding ?? 0,
        }
      : null;
    return (
      <RequisitionVsIssueTable
        rows={rows as RequisitionVsIssueRow[] | undefined}
        totals={totals}
        generatedAt={generatedAt}
        isLoading={isLoading}
        isError={isError}
        onRetry={onRetry}
      />
    );
  }

  const t = (meta?.totals ?? null) as Partial<CostCentreVarianceTotals> | null;
  const totals: CostCentreVarianceTotals | null = t
    ? {
        budgeted: t.budgeted ?? "0.0000",
        actual: t.actual ?? "0.0000",
        variance: t.variance ?? "0.0000",
      }
    : null;
  return (
    <CostCentreVarianceTable
      rows={rows as CostCentreVarianceRow[] | undefined}
      totals={totals}
      generatedAt={generatedAt}
      isLoading={isLoading}
      isError={isError}
      onRetry={onRetry}
    />
  );
}

/** Both reports are project-scoped + range-based. */
function buildDescriptor(tab: RccReportTab): ReportDescriptor {
  return {
    name: REPORT_NAME[tab],
    title: "",
    description: "",
    category: "REQUISITION_COST_CONTROL",
    viewerRoute: "/reports/requisition-cost-control",
    requiredPermission: "reports",
    parameters: [],
    projectScoped: true,
    supportsAsOf: false,
    supportsDateRange: true,
  };
}
