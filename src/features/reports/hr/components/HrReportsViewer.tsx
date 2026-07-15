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
import { useAuthenticatedUser } from "@/providers/session-provider";
import { ReportExportControl } from "../../components/ReportExportControl";
import { ReportParameterPanel } from "../../components/ReportParameterPanel";
import { type ReportDescriptor, type ReportParams } from "../../types";
import {
  REPORT_NAME,
  type AttendanceSummaryRow,
  type AttendanceTotals,
  type EmployeePaymentRow,
  type EmployeePaymentTotals,
  type HrReportTab,
  type SalaryRegisterRow,
  type SalaryRegisterTotals,
} from "../types";
import {
  breadcrumbFor,
  emptyLabelFor,
  subtitleFor,
  useHrReport,
} from "../hooks/useHrReport";
import { AttendanceSummaryTable } from "./AttendanceSummaryTable";
import { EmployeePaymentHistoryTable } from "./EmployeePaymentHistoryTable";
import { HrReportFilters } from "./HrReportFilters";
import { HrReportSwitcher } from "./HrReportSwitcher";
import { SalaryRegisterTable } from "./SalaryRegisterTable";

/**
 * FE-60 `/reports/hr` — three HR reports behind one switcher (FR-RPT-026/-027/
 * -028). Reuses FE-54's shared panel + Export; adds the switcher, three
 * bodies, and the report-specific filter slot. HR reports are not
 * project-scoped; role gating is via `reports:hr` (server-authoritative).
 */
export function HrReportsViewer() {
  const online = useOnline();
  const user = useAuthenticatedUser();
  const [tab, setTab] = useState<HrReportTab>("SALARY_REGISTER");
  const [params, setParams] = useState<ReportParams>({
    financialYearId: user.financialYearId ?? "",
  });
  const [ran, setRan] = useState(false);
  const [monthError, setMonthError] = useState<string | null>(null);
  const [runXorError, setRunXorError] = useState<string | null>(null);

  const descriptor: ReportDescriptor = useMemo(() => buildDescriptor(tab), [tab]);

  const effectiveParams = useMemo<ReportParams>(() => {
    const p: ReportParams = { ...params };
    if (tab === "PAYMENT_HISTORY") {
      p.asOf = null;
      p.periodId = null;
    } else {
      p.dateFrom = null;
      p.dateTo = null;
      p.asOf = null;
      p.periodId = null;
    }
    return p;
  }, [params, tab]);

  const query = useHrReport(tab, effectiveParams, ran);

  function onTabChange(next: HrReportTab) {
    // Reset per-tab extras and re-fetch trigger; keep FY.
    setParams((prev) => ({
      financialYearId: prev.financialYearId,
      extras: {},
    }));
    setMonthError(null);
    setRunXorError(null);
    setRan(false);
    setTab(next);
  }

  function onRun(p: ReportParams) {
    if (tab === "ATTENDANCE_SUMMARY") {
      if (!(p.extras?.month as string | undefined)) {
        setMonthError("Select a month.");
        return;
      }
      setMonthError(null);
    }
    if (tab === "SALARY_REGISTER") {
      const runId = (p.extras?.salaryRunId as string | undefined) ?? "";
      const month = (p.extras?.month as string | undefined) ?? "";
      if (!runId && !month) {
        setRunXorError("Select a salary run, or a financial year and month.");
        return;
      }
      setRunXorError(null);
    }
    setParams(p);
    setRan(true);
  }

  const err = query.error ? asApiError(query.error) : null;
  const forbidden = err?.status === 403;
  const dateInvalid =
    tab === "PAYMENT_HISTORY" && params.dateFrom && params.dateTo && params.dateFrom > params.dateTo
      ? "'Date from' must be before 'Date to'."
      : null;

  return (
    <div className="mx-auto max-w-[1400px] px-6 py-6" data-testid="hr-viewer">
      <Breadcrumb
        items={[
          { label: "Reports", href: "/reports" },
          { label: breadcrumbFor(tab) },
        ]}
      />
      <div className="mb-4 mt-1 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[23px] font-bold tracking-[-0.02em]" data-testid="hr-title">
            HR reports
            <Badge tone="neutral" className="ml-2" data-testid="hr-readonly-pill">
              Read-only · exportable
            </Badge>
          </h1>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Attendance · salary register · payment history — HR&rsquo;s
            numbers, rendered verbatim.
          </p>
        </div>
      </div>

      <HrReportSwitcher value={tab} onChange={onTabChange} />

      {!online && (
        <Alert
          tone="warning"
          title="You're offline. This report can't be loaded right now."
          className="mt-4"
          data-testid="hr-offline"
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

        <HrReportFilters
          tab={tab}
          value={params}
          onChange={setParams}
          monthError={monthError}
          runXorError={runXorError}
        />

        {dateInvalid && (
          <Alert
            tone="destructive"
            title={dateInvalid}
            data-testid="hr-date-error"
          />
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
          <div className="p-8" data-testid="hr-forbidden">
            <EmptyState
              icon={Ban}
              title="You don't have permission to view this report."
              description="HR reports are gated by the reports:hr resource — ask an administrator."
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

function BodyForTab({
  tab,
  data,
  isLoading,
  isError,
  onRetry,
  emptyLabel,
}: {
  tab: HrReportTab;
  data: ReturnType<typeof useHrReport>["data"];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  emptyLabel: string;
}) {
  const meta = data?.meta;
  const rows = data?.rows;
  const generatedAt = meta?.generatedAt;

  if (tab === "ATTENDANCE_SUMMARY") {
    const t = (meta?.totals ?? null) as Partial<AttendanceTotals> | null;
    const totals: AttendanceTotals | null = t
      ? {
          present: t.present ?? 0,
          paidLeave: t.paidLeave ?? 0,
          unpaidLeave: t.unpaidLeave ?? 0,
          absent: t.absent ?? 0,
          headCount: t.headCount ?? 0,
        }
      : null;
    return (
      <AttendanceSummaryTable
        rows={rows as AttendanceSummaryRow[] | undefined}
        totals={totals}
        generatedAt={generatedAt}
        isLoading={isLoading}
        isError={isError}
        onRetry={onRetry}
        emptyLabel={emptyLabel}
      />
    );
  }

  if (tab === "SALARY_REGISTER") {
    const t = (meta?.totals ?? null) as Partial<SalaryRegisterTotals> | null;
    const totals: SalaryRegisterTotals | null = t
      ? { gross: t.gross ?? "0.0000", net: t.net ?? "0.0000" }
      : null;
    return (
      <SalaryRegisterTable
        rows={rows as SalaryRegisterRow[] | undefined}
        totals={totals}
        generatedAt={generatedAt}
        isLoading={isLoading}
        isError={isError}
        onRetry={onRetry}
        emptyLabel={emptyLabel}
      />
    );
  }

  const t = (meta?.totals ?? null) as Partial<EmployeePaymentTotals> | null;
  const totals: EmployeePaymentTotals | null = t
    ? { paidCount: t.paidCount ?? 0, totalPaid: t.totalPaid ?? "0.0000" }
    : null;
  return (
    <EmployeePaymentHistoryTable
      rows={rows as EmployeePaymentRow[] | undefined}
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
 * Build a synthetic FE-54 descriptor per tab — only Payment history uses the
 * shared date-range control (attendance uses its own Month field; salary
 * register uses run XOR (FY+month)). HR reports are not project-scoped.
 */
function buildDescriptor(tab: HrReportTab): ReportDescriptor {
  return {
    name: REPORT_NAME[tab],
    title: "",
    description: "",
    category: "HR",
    viewerRoute: "/reports/hr",
    requiredPermission: "reports",
    parameters: [],
    projectScoped: false,
    supportsAsOf: false,
    supportsDateRange: tab === "PAYMENT_HISTORY",
  };
}
