"use client";

import { useMemo, useState } from "react";
import { Ban, WifiOff } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { asApiError } from "@/lib/api/errors";
import { useOnline } from "@/lib/hooks/use-online";
import { isUnscopedRole, isRole } from "@/lib/auth/roles";
import { useAuthenticatedUser } from "@/providers/session-provider";
import { ReportExportControl } from "../../components/ReportExportControl";
import { ReportParameterPanel } from "../../components/ReportParameterPanel";
import { type ReportDescriptor, type ReportParams } from "../../types";
import {
  REPORT_NAME,
  type ProjectPnlRow,
  type ProjectPnlTotals,
  type CostCentreVarianceRow,
  type CostCentreVarianceTotals,
  type IpcBillingRow,
  type IpcBillingTotals,
  type LabourCostRow,
  type LabourCostTotals,
  type OutstandingProjectTotals,
  type ProjectReportTab,
} from "../types";
import {
  breadcrumbFor,
  emptyLabelFor,
  subtitleFor,
  useProjectIpcReport,
} from "../hooks/useProjectIpcReport";
import { IpcBillingTable } from "./IpcBillingTable";
import { LabourCostTable } from "./LabourCostTable";
import { MaterialConsumptionTable } from "./MaterialConsumptionTable";
import { OutstandingTable } from "./OutstandingTable";
import { ProjectIpcReportSwitcher } from "./ProjectIpcReportSwitcher";
import { ProjectPnlTable } from "./ProjectPnlTable";
import { ReportSpecificFilters } from "./ReportSpecificFilters";

/**
 * FE-57 `/reports/project-ipc` — the project-lens report family (FR-RPT-015..020).
 * Hosts the five-report switcher + the shared FE-54 parameter panel + the
 * per-report body. Project is preserved across tab switches (spec §9); Project
 * P&L requires a project (server 400 + FE gate with the design's "Select a
 * project." blocker); PM out-of-scope projectId → server 403 + friendly view.
 */
export function ProjectIpcViewer() {
  const online = useOnline();
  const user = useAuthenticatedUser();
  const [tab, setTab] = useState<ProjectReportTab>("PROJECT_PNL");
  const [params, setParams] = useState<ReportParams>({
    financialYearId: user.financialYearId ?? "",
  });
  const [ran, setRan] = useState(false);

  const descriptor: ReportDescriptor = useMemo(() => buildDescriptor(tab), [tab]);

  const effectiveParams = useMemo<ReportParams>(() => {
    const p: ReportParams = { ...params };
    if (tab === "OUTSTANDING") {
      // As-of report — clear the range if set.
      p.dateFrom = null;
      p.dateTo = null;
    } else {
      p.asOf = null;
      p.periodId = null;
    }
    // The other tabs treat projectId as optional; only Project P&L requires it.
    return p;
  }, [params, tab]);

  const query = useProjectIpcReport(tab, effectiveParams, ran);

  function onTabChange(next: ProjectReportTab) {
    // Preserve project + FY + CC + range/as-of across the switch (spec §9).
    setRan(false);
    setTab(next);
  }

  function onRun(p: ReportParams) {
    setParams(p);
    setRan(true);
  }

  const err = query.error ? asApiError(query.error) : null;
  const forbidden = err?.status === 403;
  const roleUnscoped = isRole(user.role) ? isUnscopedRole(user.role) : false;

  const pmChip = !roleUnscoped ? (
    <Badge tone="info" className="ml-2" data-testid="pi-pm-scope-chip">
      PM · assigned only
    </Badge>
  ) : null;

  return (
    <div className="mx-auto max-w-[1400px] px-6 py-6" data-testid="pi-viewer">
      <Breadcrumb
        items={[
          { label: "Reports", href: "/reports" },
          { label: breadcrumbFor(tab) },
        ]}
      />
      <div className="mb-4 mt-1 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1
            className="text-[23px] font-bold tracking-[-0.02em]"
            data-testid="pi-title"
          >
            Project &amp; IPC reports
            {pmChip}
          </h1>
          <p className="mt-1 text-[13px] text-muted-foreground">
            One project across five lenses — read-only, server-computed.
          </p>
        </div>
      </div>

      <ProjectIpcReportSwitcher value={tab} onChange={onTabChange} />

      {!online && (
        <Alert
          tone="warning"
          title="You're offline. This report can't be loaded right now."
          className="mt-4"
          data-testid="pi-offline"
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

        {tab === "PROJECT_PNL" && !params.projectId && (
          <Alert
            tone="info"
            title="Select a project."
            className=""
            data-testid="pi-project-required"
          >
            <span className="text-[12.5px]" aria-live="polite">
              Project P&amp;L needs a specific project — Run stays disabled until you
              pick one above.
            </span>
          </Alert>
        )}

        <ReportSpecificFilters tab={tab} value={params} onChange={setParams} />
      </div>

      <Card className="mt-4 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
          <div>
            <h2 className="text-[14px] font-bold text-foreground">
              {breadcrumbFor(tab)}
            </h2>
            <p className="mt-0.5 text-[11.5px] text-muted-foreground">
              {subtitleFor(tab)}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <ReportExportControl
              reportName={REPORT_NAME[tab]}
              params={effectiveParams}
              disabled={!online || forbidden}
            />
            {tab === "IPC_BILLING" && (
              <span
                className="text-[11px] text-muted-foreground"
                data-testid="pi-ipc-bin-tin-note"
              >
                Excel and PDF exports of the IPC report include your company&rsquo;s
                BIN/TIN for NBR use.
              </span>
            )}
          </div>
        </div>

        {forbidden ? (
          <div className="p-8" data-testid="pi-forbidden">
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
            emptyLabel={emptyLabelFor(tab)}
          />
        )}
      </Card>
    </div>
  );
}

/** Route the right table for the active tab, casting the shared payload. */
function BodyForTab({
  tab,
  data,
  isLoading,
  isError,
  onRetry,
  emptyLabel,
}: {
  tab: ProjectReportTab;
  data: ReturnType<typeof useProjectIpcReport>["data"];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  emptyLabel: string;
}) {
  const meta = data?.meta;
  const rows = data?.rows;
  const generatedAt = meta?.generatedAt;

  if (tab === "PROJECT_PNL") {
    const t = (meta?.totals ?? null) as Partial<ProjectPnlTotals> | null;
    const totals: ProjectPnlTotals | null = t
      ? { revenue: t.revenue ?? "0.0000", cost: t.cost ?? "0.0000", profit: t.profit ?? "0.0000" }
      : null;
    return (
      <ProjectPnlTable
        rows={rows as ProjectPnlRow[] | undefined}
        totals={totals}
        generatedAt={generatedAt}
        isLoading={isLoading}
        isError={isError}
        onRetry={onRetry}
        emptyLabel={emptyLabel}
      />
    );
  }

  if (tab === "IPC_BILLING") {
    const t = (meta?.totals ?? null) as Partial<IpcBillingTotals> | null;
    const totals: IpcBillingTotals | null = t
      ? {
          certified: t.certified ?? "0.0000",
          billed: t.billed ?? "0.0000",
          received: t.received ?? "0.0000",
          outstanding: t.outstanding ?? "0.0000",
          retentionHeld: t.retentionHeld ?? "0.0000",
        }
      : null;
    return (
      <IpcBillingTable
        rows={rows as IpcBillingRow[] | undefined}
        totals={totals}
        generatedAt={generatedAt}
        isLoading={isLoading}
        isError={isError}
        onRetry={onRetry}
        emptyLabel={emptyLabel}
      />
    );
  }

  if (tab === "OUTSTANDING") {
    const t = (meta?.totals ?? null) as Partial<IpcBillingTotals> | null;
    const projectTotals =
      (meta as { projectTotals?: OutstandingProjectTotals } | undefined)?.projectTotals ??
      null;
    const totals: IpcBillingTotals | null = t
      ? {
          certified: t.certified ?? "0.0000",
          billed: t.billed ?? "0.0000",
          received: t.received ?? "0.0000",
          outstanding: t.outstanding ?? "0.0000",
          retentionHeld: t.retentionHeld ?? "0.0000",
        }
      : null;
    return (
      <OutstandingTable
        rows={rows as IpcBillingRow[] | undefined}
        totals={totals}
        projectTotals={projectTotals}
        generatedAt={generatedAt}
        isLoading={isLoading}
        isError={isError}
        onRetry={onRetry}
        emptyLabel={emptyLabel}
      />
    );
  }

  if (tab === "MATERIAL_CONSUMPTION") {
    const t = (meta?.totals ?? null) as Partial<CostCentreVarianceTotals> | null;
    const totals: CostCentreVarianceTotals | null = t
      ? {
          budgeted: t.budgeted ?? "0.0000",
          actual: t.actual ?? "0.0000",
          variance: t.variance ?? "0.0000",
        }
      : null;
    return (
      <MaterialConsumptionTable
        rows={rows as CostCentreVarianceRow[] | undefined}
        totals={totals}
        generatedAt={generatedAt}
        isLoading={isLoading}
        isError={isError}
        onRetry={onRetry}
        emptyLabel={emptyLabel}
      />
    );
  }

  // LABOUR_COST
  const t = (meta?.totals ?? null) as Partial<LabourCostTotals> | null;
  const totals: LabourCostTotals | null = t
    ? { labourCost: t.labourCost ?? "0.0000" }
    : null;
  return (
    <LabourCostTable
      rows={rows as LabourCostRow[] | undefined}
      totals={totals}
      generatedAt={generatedAt}
      isLoading={isLoading}
      isError={isError}
      onRetry={onRetry}
      emptyLabel={emptyLabel}
    />
  );
}

/**
 * Build a synthetic FE-54 descriptor per tab — the shared panel reads
 * `projectScoped` / `supportsAsOf` / `supportsDateRange` off it. `PROJECT_PNL`
 * is `projectScoped: true` (FE-54's schema also enforces the required project)
 * so the panel's schema and this viewer's local gate agree.
 */
function buildDescriptor(tab: ProjectReportTab): ReportDescriptor {
  const projectScoped = true; // panel shows the Project field for every tab
  const asOfOnly = tab === "OUTSTANDING";
  return {
    name: REPORT_NAME[tab],
    title: "",
    description: "",
    category: "PROJECT_IPC",
    viewerRoute: "/reports/project-ipc",
    requiredPermission: "reports",
    parameters: [],
    projectScoped,
    supportsAsOf: asOfOnly,
    supportsDateRange: !asOfOnly,
  };
}
