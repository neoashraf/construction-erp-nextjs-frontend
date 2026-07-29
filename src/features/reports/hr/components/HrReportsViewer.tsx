"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Ban, WifiOff } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ReportViewerHeader, type ReportScopeTone } from "../../components/ReportViewerHeader";
import { asApiError } from "@/lib/api/errors";
import { cn } from "@/lib/utils";
import { useOnline } from "@/lib/hooks/use-online";
import { useAuthenticatedUser } from "@/providers/session-provider";
import { ReportExportControl } from "../../components/ReportExportControl";
import { ReportParameterPanel } from "../../components/ReportParameterPanel";
import { type ReportDescriptor, type ReportParams } from "../../types";
import {
  ATTENDANCE_LEVEL_ENDPOINT,
  ATTENDANCE_LEVEL_LABEL,
  REPORT_NAME,
  type AttendanceDailyRow,
  type AttendanceLevel,
  type AttendanceRangeRow,
  type AttendanceReportTotals,
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
  useAttendanceLevelReport,
  useHrReport,
} from "../hooks/useHrReport";
import { AttendanceDailyTable } from "./AttendanceDailyTable";
import { AttendanceDetailControl } from "./AttendanceDetailControl";
import { AttendanceMobileNotice } from "./AttendanceMobileNotice";
import { AttendanceRangeTable } from "./AttendanceRangeTable";
import { AttendanceSummaryTable } from "./AttendanceSummaryTable";
import { ddMmYyyy } from "./shared";
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
/** Reverse REPORT_NAME → tab so the hub can open this viewer on a chosen report. */
function reportToTab(name?: string): HrReportTab {
  const found = (Object.entries(REPORT_NAME) as [HrReportTab, string][]).find(
    ([, n]) => n === name,
  );
  return found?.[0] ?? "SALARY_REGISTER";
}

export function HrReportsViewer({
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
  const [tab, setTab] = useState<HrReportTab>(() => reportToTab(initialReport));
  const [params, setParams] = useState<ReportParams>({
    financialYearId: user.financialYearId ?? "",
  });
  const [ran, setRan] = useState(false);
  const [monthError, setMonthError] = useState<string | null>(null);
  const [runXorError, setRunXorError] = useState<string | null>(null);
  /**
   * FE-66 — the attendance detail level. Summary is the landing grain, since the
   * registered report (FR-RPT-026) and the dashboard tile that drills in here are
   * both monthly roll-ups.
   */
  const [level, setLevel] = useState<AttendanceLevel>("SUMMARY");
  const [announcement, setAnnouncement] = useState("");
  const resultsHeading = useRef<HTMLHeadingElement>(null);
  /** Set once a level change has been made, so focus moves only on a real switch. */
  const pendingFocus = useRef(false);

  const descriptor: ReportDescriptor = useMemo(() => buildDescriptor(tab), [tab]);

  const effectiveParams = useMemo<ReportParams>(() => {
    const p: ReportParams = { ...params };
    if (tab === "PAYMENT_HISTORY") {
      p.asOf = null;
      p.periodId = null;
    } else if (tab === "ATTENDANCE_SUMMARY" && level !== "SUMMARY") {
      // Daily and Range read an arbitrary window — the date bounds ARE the query.
      p.asOf = null;
      p.periodId = null;
    } else {
      p.dateFrom = null;
      p.dateTo = null;
      p.asOf = null;
      p.periodId = null;
    }
    // Attendance-summary is keyed by `month`, not the financial year — its backend
    // DTO forbids financialYearId, so drop it from what we actually send.
    if (tab === "ATTENDANCE_SUMMARY") p.financialYearId = "";
    return p;
  }, [params, tab, level]);

  /**
   * The attendance report is ONE report at three grains, so the level decides
   * which read backs it — never a client-side re-filter of a cached result
   * (spec §9). Summary is RPT's registered `attendance-summary`; Daily and Range
   * are HR's own routes, adapted in `api/attendance-levels`.
   */
  const attendanceLevelActive = tab === "ATTENDANCE_SUMMARY" && level !== "SUMMARY";
  const query = useHrReport(tab, effectiveParams, ran && !attendanceLevelActive);
  const levelQuery = useAttendanceLevelReport(
    level,
    effectiveParams,
    ran && attendanceLevelActive,
  );

  const active = attendanceLevelActive
    ? {
        isFetching: levelQuery.isFetching,
        isError: levelQuery.isError,
        error: levelQuery.error,
        refetch: () => void levelQuery.refetch(),
        rowCount: levelQuery.data?.rows.length ?? 0,
        settled: levelQuery.isSuccess || levelQuery.isError,
      }
    : {
        isFetching: query.isFetching,
        isError: query.isError,
        error: query.error,
        refetch: () => void query.refetch(),
        rowCount: query.data?.rows.length ?? 0,
        settled: query.isSuccess || query.isError,
      };

  /**
   * A level change replaces the table entirely, so announce the new level and the
   * row count, and move focus to the results heading — otherwise a screen-reader
   * user is silently left on a control whose result has been swapped underneath
   * them (spec §10).
   */
  useEffect(() => {
    // Wait for the new grain to actually SETTLE — announcing mid-flight would
    // report the previous level's row count, or zero before anything arrived.
    if (!pendingFocus.current || active.isFetching || !active.settled) return;
    pendingFocus.current = false;
    setAnnouncement(
      `${ATTENDANCE_LEVEL_LABEL[level]} detail — ${active.rowCount} ${
        active.rowCount === 1 ? "row" : "rows"
      }.`,
    );
    resultsHeading.current?.focus();
  }, [active.isFetching, active.settled, active.rowCount, level]);

  const onLevelChange = useCallback((next: AttendanceLevel) => {
    setLevel(next);
    pendingFocus.current = true;
  }, []);

  function onTabChange(next: HrReportTab) {
    // Reset per-tab extras and re-fetch trigger; keep FY.
    setParams((prev) => ({
      financialYearId: prev.financialYearId,
      extras: {},
    }));
    setMonthError(null);
    setRunXorError(null);
    setRan(false);
    setLevel("SUMMARY");
    setTab(next);
    onReportChange?.(REPORT_NAME[next], breadcrumbFor(next));
  }

  function onRun(p: ReportParams) {
    if (tab === "ATTENDANCE_SUMMARY") {
      if (level === "SUMMARY") {
        if (!(p.extras?.month as string | undefined)) {
          setMonthError("Select a month.");
          return;
        }
        setMonthError(null);
      } else if (p.dateFrom && p.dateTo && p.dateFrom > p.dateTo) {
        // Blocks inline at Daily/Range; the shared range control owns the copy.
        return;
      }
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

  const err = active.error ? asApiError(active.error) : null;
  const forbidden = err?.status === 403;
  const dateInvalid =
    tab === "PAYMENT_HISTORY" && params.dateFrom && params.dateTo && params.dateFrom > params.dateTo
      ? "'Date from' must be before 'Date to'."
      : null;
  /** The same rule at attendance Daily/Range, rendered inside the filter block. */
  const rangeDateInvalid =
    attendanceLevelActive && params.dateFrom && params.dateTo && params.dateFrom > params.dateTo
      ? "'Date from' must be before 'Date to'."
      : null;

  /**
   * "The file matches what's on screen — {level} detail, {period}." (spec §8).
   * Export re-issues the identical query with `format` changed, so the note
   * names the grain and the window the download will actually contain.
   */
  const exportScopeNote = useMemo(() => {
    if (tab !== "ATTENDANCE_SUMMARY") return undefined;
    const period =
      level === "SUMMARY"
        ? ((params.extras?.month as string | undefined) ?? "the selected month")
        : params.dateFrom && params.dateTo
          ? `${ddMmYyyy(params.dateFrom)}–${ddMmYyyy(params.dateTo)}`
          : "the selected period";
    return `The file matches what's on screen — ${ATTENDANCE_LEVEL_LABEL[level]} detail, ${period}.`;
  }, [tab, level, params.extras, params.dateFrom, params.dateTo]);

  // Scope pill: attendance (by month) + salary register (by run) are balance
  // reports (violet); payment history is a date-range flow report (blue).
  const { scopeLabel, scopeTone } = ((): { scopeLabel: string; scopeTone: ReportScopeTone } => {
    if (tab === "PAYMENT_HISTORY") return { scopeLabel: "Flow · date range", scopeTone: "blue" };
    if (tab === "ATTENDANCE_SUMMARY") return { scopeLabel: "Balance · month", scopeTone: "violet" };
    return { scopeLabel: "Balance · run", scopeTone: "violet" };
  })();

  return (
    <div className={embedded ? "" : "mx-auto max-w-[1400px] px-6 py-6"} data-testid="hr-viewer">
      {!embedded && (
        <ReportViewerHeader
          breadcrumbLabel={breadcrumbFor(tab)}
          title={breadcrumbFor(tab)}
          scopeLabel={scopeLabel}
          scopeTone={scopeTone}
          titleTestId="hr-title"
        />
      )}

      {/* The `/reports` hub's catalog card already renders the chip row. */}
      {!embedded && <HrReportSwitcher value={tab} onChange={onTabChange} />}

      {/*
        Level 2 — subordinate to the Level-1 report switcher and shown ONLY on the
        attendance tab: the salary register and payment history have one grain
        each, so a detail control there would offer a choice that does not exist.
      */}
      {tab === "ATTENDANCE_SUMMARY" && (
        <>
          {/*
            ≤640 the report degrades to the notice frame the comp specifies: the
            wide roll-up and its Export are hidden (CSS-only, so there is no
            viewport-detection flash) and the phone gets the pointer to the
            capture screen, which is the surface that answers an on-site question.
          */}
          <div className="mt-3 sm:hidden">
            <AttendanceMobileNotice />
          </div>
          <div className="max-sm:hidden">
            <AttendanceDetailControl value={level} onChange={onLevelChange} disabled={!online} />
          </div>
        </>
      )}

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

      <div
        className={cn("mt-4 space-y-3", tab === "ATTENDANCE_SUMMARY" && "max-sm:hidden")}
      >
        {/*
          Attendance renders its per-level fields INSIDE the shared panel's
          leading slot, so the design's single horizontal filter row holds
          Month/Dates · Employee · Filters · Run rather than splitting across two
          cards. The other two reports keep their own filter block below, where
          the salary register's run-XOR fieldset needs the room.
        */}
        <ReportParameterPanel
          descriptor={descriptor}
          value={params}
          onChange={setParams}
          onRun={onRun}
          running={active.isFetching}
          disabled={!online}
          // Attendance is keyed by month (Summary) or a date range (Daily/Range),
          // never by the financial year — and its DTO rejects `financialYearId`.
          hideFinancialYear={tab === "ATTENDANCE_SUMMARY"}
          leadingSlot={
            tab === "ATTENDANCE_SUMMARY" ? (
              <HrReportFilters
                tab={tab}
                level={level}
                value={params}
                onChange={setParams}
                monthError={monthError}
                runXorError={runXorError}
                dateError={rangeDateInvalid}
                inline
              />
            ) : undefined
          }
        />

        {tab !== "ATTENDANCE_SUMMARY" && (
          <HrReportFilters
            tab={tab}
            level={level}
            value={params}
            onChange={setParams}
            monthError={monthError}
            runXorError={runXorError}
            dateError={rangeDateInvalid}
          />
        )}

        {dateInvalid && (
          <Alert
            tone="destructive"
            title={dateInvalid}
            data-testid="hr-date-error"
          />
        )}
      </div>

      <Card
        className={cn(
          "mt-4 overflow-hidden",
          // The nine-column roll-up (and its Export) belong to the notice frame's
          // "open this on a desktop or tablet", so neither renders on a phone.
          tab === "ATTENDANCE_SUMMARY" && "max-sm:hidden",
        )}
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
          <div>
            {/*
              The results heading is the focus target on a level change, so it
              names the grain being shown ("Attendance summary — Daily detail").
              `tabIndex={-1}` makes it programmatically focusable without adding
              a tab stop for keyboard users who did not change level.
            */}
            <h2
              id="results-heading"
              ref={resultsHeading}
              tabIndex={-1}
              className="text-[14px] font-bold text-foreground outline-none"
              data-testid="hr-results-heading"
            >
              {breadcrumbFor(tab)}
              {tab === "ATTENDANCE_SUMMARY" && ` — ${ATTENDANCE_LEVEL_LABEL[level]} detail`}
            </h2>
            <p className="mt-0.5 text-[11.5px] text-muted-foreground">{subtitleFor(tab)}</p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <ReportExportControl
              // Export never exports a grain other than the one displayed: the
              // report name follows the active level (FR-RPT-029; spec §9).
              reportName={
                attendanceLevelActive
                  ? ATTENDANCE_LEVEL_ENDPOINT[level]
                  : REPORT_NAME[tab]
              }
              params={effectiveParams}
              disabled={!online || forbidden}
              scopeNote={exportScopeNote}
            />
          </div>
        </div>

        {/* Level changes replace the table wholesale — say so out loud. */}
        <p className="sr-only" role="status" aria-live="polite" data-testid="hr-level-announcement">
          {announcement}
        </p>

        {forbidden ? (
          <div className="p-8" data-testid="hr-forbidden">
            <EmptyState
              icon={Ban}
              title="You don't have permission to view this report."
              description="HR reports are gated by the reports:hr resource — ask an administrator."
            />
          </div>
        ) : attendanceLevelActive ? (
          // Daily / Range — HR's own routes, already adapted to rows + totals.
          level === "DAILY" ? (
            <AttendanceDailyTable
              rows={levelQuery.data?.rows as AttendanceDailyRow[] | undefined}
              totals={levelQuery.data?.totals ?? null}
              generatedAt={levelQuery.data?.generatedAt}
              isLoading={levelQuery.isFetching}
              isError={levelQuery.isError && !forbidden}
              onRetry={() => void levelQuery.refetch()}
              emptyLabel={emptyLabelFor(tab, level)}
            />
          ) : (
            <AttendanceRangeTable
              rows={levelQuery.data?.rows as AttendanceRangeRow[] | undefined}
              totals={levelQuery.data?.totals ?? null}
              generatedAt={levelQuery.data?.generatedAt}
              isLoading={levelQuery.isFetching}
              isError={levelQuery.isError && !forbidden}
              onRetry={() => void levelQuery.refetch()}
              emptyLabel={emptyLabelFor(tab, level)}
            />
          )
        ) : (
          <BodyForTab
            tab={tab}
            data={query.data}
            isLoading={query.isFetching}
            isError={query.isError && !forbidden}
            onRetry={() => query.refetch()}
            emptyLabel={emptyLabelFor(tab, level)}
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
    const t = (meta?.totals ?? null) as Partial<AttendanceTotals & { attendancePercentage: number }> | null;
    // No server totals → `null` → the band renders nothing. There is deliberately
    // no page-sum fallback here (FR-RPT-004).
    const totals: AttendanceReportTotals | null = t
      ? {
          present: t.present ?? 0,
          paidLeave: t.paidLeave ?? 0,
          unpaidLeave: t.unpaidLeave ?? 0,
          absent: t.absent ?? 0,
          headCount: t.headCount ?? 0,
          attendancePercentage:
            typeof t.attendancePercentage === "number" ? t.attendancePercentage : null,
          scopeNote:
            rows && meta
              ? `${meta.total ?? rows.length} rows${t.headCount ? ` · ${t.headCount} people counted` : ""}`
              : undefined,
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
