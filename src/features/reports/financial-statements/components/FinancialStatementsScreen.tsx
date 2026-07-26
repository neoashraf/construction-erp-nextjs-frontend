"use client";

import { useMemo, useState } from "react";
import { WifiOff } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { ReportViewerHeader, type ReportScopeTone } from "../../components/ReportViewerHeader";
import { useOnline } from "@/lib/hooks/use-online";
import { useAuthenticatedUser } from "@/providers/session-provider";
import { ReportParameterPanel } from "../../components/ReportParameterPanel";
import { ReportExportControl } from "../../components/ReportExportControl";
import { type ReportDescriptor, type ReportParams } from "../../types";
import {
  type BalanceSheetRow,
  type BalanceSheetTotals,
  type PnlTotals,
  type ProjectPnlRow,
  type Scope,
  type StatementTab,
} from "../types";
import { useFinancialStatement } from "../hooks/useFinancialStatement";
import { BalanceSheetStatement } from "./BalanceSheetStatement";
import { ProfitLossStatement } from "./ProfitLossStatement";
import { ProjectWiseCaveatBanner } from "./ProjectWiseCaveatBanner";
import { ScopeToggle } from "./ScopeToggle";
import { StatementSwitcher } from "./StatementSwitcher";

/**
 * FE-55 `/reports/financial-statements` viewer — the P&L / Balance-sheet tab
 * switcher + Consolidated/Project-wise scope toggle, plus the two statement
 * bodies. Reuses the shared `ReportParameterPanel` + `ReportExportControl`
 * from FE-54 verbatim; adds only the report-shape-specific bits (statement
 * bodies, the project-wise caveat, and the per-tab time-control gating).
 */
export function FinancialStatementsScreen({
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
  const [tab, setTab] = useState<StatementTab>(
    () => (initialReport === "balance-sheet" ? "BS" : "PNL"),
  );
  const [scope, setScope] = useState<Scope>("CONSOLIDATED");
  const [params, setParams] = useState<ReportParams>({
    financialYearId: user.financialYearId ?? "",
  });
  const [ran, setRan] = useState(false);
  const [lastProjectId, setLastProjectId] = useState<string | null>(null);

  // Build a synthetic descriptor for the shared panel — each tab shows only its
  // own time control (spec §7).
  const descriptor: ReportDescriptor = useMemo(
    () => buildDescriptor(tab, scope),
    [tab, scope],
  );

  const effectiveParams = useMemo<ReportParams>(() => {
    const p: ReportParams = { ...params };
    if (scope === "CONSOLIDATED") p.projectId = null;
    else p.projectId = params.projectId ?? lastProjectId ?? null;
    if (tab === "PNL") {
      p.asOf = null;
      p.periodId = null;
    } else {
      p.dateFrom = null;
      p.dateTo = null;
    }
    return p;
  }, [params, scope, tab, lastProjectId]);

  const statement = useFinancialStatement(tab, effectiveParams, ran);

  function onScopeChange(next: Scope) {
    if (next === "CONSOLIDATED") {
      setLastProjectId(params.projectId ?? null);
      setParams({ ...params, projectId: null });
    } else {
      setParams({ ...params, projectId: params.projectId ?? lastProjectId ?? null });
    }
    setScope(next);
    setRan(false);
  }

  function onTabChange(next: StatementTab) {
    setTab(next);
    setRan(false);
    onReportChange?.(
      next === "PNL" ? "profit-and-loss" : "balance-sheet",
      next === "PNL" ? "Profit & loss" : "Balance sheet",
    );
  }

  const projectWise = scope === "PROJECT_WISE" && !!effectiveParams.projectId;

  const totalsPnl = (statement.data?.meta.totals ?? null) as Partial<PnlTotals> | null;
  const totalsBs = (statement.data?.meta.totals ?? null) as Partial<BalanceSheetTotals> | null;

  const pnlTotals: PnlTotals | null = tab === "PNL" && totalsPnl
    ? {
        revenue: totalsPnl.revenue ?? "0.0000",
        cost: totalsPnl.cost ?? "0.0000",
        profit: totalsPnl.profit ?? "0.0000",
      }
    : null;

  const bsTotals: BalanceSheetTotals | null = tab === "BS" && totalsBs
    ? {
        assets: totalsBs.assets ?? "0.0000",
        liabilities: totalsBs.liabilities ?? "0.0000",
        equity: totalsBs.equity ?? "0.0000",
      }
    : null;

  const bsPartial = tab === "BS" && projectWise;

  const statementLabel = tab === "PNL" ? "Profit & loss" : "Balance sheet";
  // P&L is a date-range flow report (blue dot); Balance sheet is an as-of report (violet).
  const scopeLabel = tab === "PNL" ? "Flow · date range" : "Balance · point-in-time";
  const scopeTone: ReportScopeTone = tab === "PNL" ? "blue" : "violet";

  return (
    <div className={embedded ? "" : "mx-auto max-w-[1400px] px-6 py-6"} data-testid="financial-statements-screen">
      {!embedded && (
        <ReportViewerHeader
          breadcrumbLabel={statementLabel}
          title={statementLabel}
          scopeLabel={scopeLabel}
          scopeTone={scopeTone}
          titleTestId="fs-title"
        />
      )}
      {/* Statement switcher (underline tabs) on the left, scope toggle on the right.
          Embedded in the `/reports` hub the catalog card already renders the chip
          row, so only the scope toggle stays — kept right-aligned. */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        {!embedded && <StatementSwitcher value={tab} onChange={onTabChange} />}
        <div className="ml-auto">
          <ScopeToggle value={scope} onChange={onScopeChange} />
        </div>
      </div>

      {!online && (
        <Alert
          tone="warning"
          title="You're offline. This report can't be loaded right now."
          className="mb-4"
          data-testid="fs-offline"
        >
          <span className="text-[12.5px]">
            <WifiOff className="mr-1 inline h-3.5 w-3.5" aria-hidden />
            Parameters are preserved — try again when you reconnect.
          </span>
        </Alert>
      )}

      {tab === "BS" && projectWise && <ProjectWiseCaveatBanner id="bs-caveat-banner" />}

      <ReportParameterPanel
        descriptor={descriptor}
        value={params}
        onChange={setParams}
        onRun={(p) => {
          setParams(p);
          setRan(true);
        }}
        running={statement.isFetching}
        disabled={!online}
      />

      <Card className="mt-4 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
          <div>
            <h2 className="text-[14px] font-bold text-foreground">
              {tab === "PNL" ? "Profit & loss" : "Balance sheet"}
              <span className="ml-2 rounded-pill bg-muted px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">
                {tab === "PNL" ? "Flow · date range" : "Balance · point-in-time"}
              </span>
            </h2>
            <p className="mt-0.5 text-[11.5px] text-muted-foreground">
              {scope === "CONSOLIDATED" ? "Consolidated (whole company)" : "Project-wise"}
            </p>
          </div>
          <ReportExportControl
            reportName={tab === "PNL" ? "profit-and-loss" : "balance-sheet"}
            params={effectiveParams}
            disabled={!online}
          />
        </div>

        {tab === "PNL" ? (
          <ProfitLossStatement
            rows={statement.data?.rows as ProjectPnlRow[] | undefined}
            totals={pnlTotals}
            generatedAt={statement.data?.meta.generatedAt}
            isLoading={statement.isFetching}
            isError={statement.isError}
            onRetry={() => statement.refetch()}
          />
        ) : (
          <BalanceSheetStatement
            rows={statement.data?.rows as BalanceSheetRow[] | undefined}
            totals={bsTotals}
            generatedAt={statement.data?.meta.generatedAt}
            isLoading={statement.isFetching}
            isError={statement.isError}
            onRetry={() => statement.refetch()}
            partial={bsPartial}
          />
        )}
      </Card>
    </div>
  );
}

function buildDescriptor(tab: StatementTab, scope: Scope): ReportDescriptor {
  return {
    name: tab === "PNL" ? "profit-and-loss" : "balance-sheet",
    title: tab === "PNL" ? "Profit & loss" : "Balance sheet",
    description: "",
    category: "FINANCIAL_STATEMENTS",
    viewerRoute: "/reports/financial-statements",
    requiredPermission: "reports",
    parameters: [],
    projectScoped: scope === "PROJECT_WISE",
    projectRequired: scope === "PROJECT_WISE",
    supportsDateRange: tab === "PNL",
    supportsAsOf: tab === "BS",
  };
}
