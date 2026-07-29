"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FileDown, Users } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/api/errors";
import { AttendanceDetailDrawer } from "./AttendanceDetailDrawer";
import { AttendanceImportDrawer } from "./AttendanceImportDrawer";
import { AttendanceLogFilterBar } from "./AttendanceLogFilterBar";
import { AttendanceLogTable } from "./AttendanceLogTable";
import { AttendancePagination } from "./AttendancePagination";
import { StatCard } from "./AttendanceStats";
import { DeviceStatusBadge } from "./DeviceStatusBadge";
import { OfficeRosterGrid } from "./OfficeRosterGrid";
import { SkipReasonAlert } from "./SkipReasonAlert";
import { SyncDeviceButton } from "./SyncDeviceButton";
import {
  type RangeReportRow,
  type SummaryReportRow,
  type SyncSummary,
} from "../api/attendance-logs";
import {
  useAttendanceSummary,
  usePunchBreakdown,
  useRangeReport,
} from "../hooks/useAttendanceLogs";
import { mapRangeReportRow, mapSummaryRow, type EmployeeRow } from "../lib/attendance-rows";
import {
  RANGE_PAGE_SIZE,
  datesForMode,
  hasActiveFilters,
  initialDraft,
  isRangeView,
  toRequestFilters,
  type DateMode,
  type FilterDraft,
} from "../lib/attendance-filters";
import { describeScope } from "../lib/attendance-time";
import { type ProjectOption } from "../types";

/**
 * The **Office staff** mode of `/hr/attendance` (spec §3; decision record §6.1).
 *
 * **The period control selects the view — it is not a third tab level.** A single date plus a
 * project renders the editable `OfficeRosterGrid`; a range or a month renders the read-only
 * logs & summary. The rationale is that only a single day is editable at all: a range is
 * inherently a review, and reusing the existing Single / Range / Month control keeps the depth
 * at two levels (mode tab → period) instead of nesting a third tab under Office staff. It also
 * removes the ambiguity of a range-wide edit, which the one-row-per-employee-day model cannot
 * express.
 *
 * The header carries exactly **three controls — one status, one pull, one push**: the
 * device-status badge, `Sync device`, and `Import`. There is no "Manual entry | Biometric
 * import" toggle; see `OfficeRosterGrid` for why it was removed.
 *
 * **No Export control lives here.** Downloads — daily, range and summary — belong to the
 * registered report at `/reports/hr`, which the header links to. This screen is on-screen
 * operational review; producing a file is a reporting concern (FR-RPT-026/-029/-031).
 */
export function OfficeStaffPanel({
  projects,
  projectId,
}: {
  projects: ProjectOption[];
  /** The shell's project filter — the roster's scope and the Location column's default. */
  projectId: string;
}) {
  const [baseline] = useState(() => initialDraft());
  const [draft, setDraft] = useState<FilterDraft>(baseline);
  const [applied, setApplied] = useState<FilterDraft>(baseline);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(RANGE_PAGE_SIZE);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [lastRun, setLastRun] = useState<SyncSummary | null>(null);

  // Switching the period replaces the WHOLE view (roster ↔ logs & summary), so focus moves to
  // the results heading and the swap is announced — a keyboard/screen-reader user must not be
  // left silently inside a table that no longer exists (spec §10).
  const resultsHeading = useRef<HTMLHeadingElement>(null);
  const modeSwapped = useRef(false);

  const appliedFilters = useMemo(() => toRequestFilters(applied), [applied]);
  const rangeView = isRangeView(applied.mode);
  const summaryMode = applied.summary;

  const query = { ...appliedFilters, page, limit };
  // The review read is the REPORT surface, not the punch log — only it emits every date in the
  // window (absences included), labels holidays, applies the late threshold and returns
  // report-wide totals. `/logs` backs the drawer's punch breakdown and nothing else.
  const rangeQuery = useRangeReport(query, rangeView && !summaryMode);
  const summaryQuery = useAttendanceSummary(query, rangeView && summaryMode);
  const active = summaryMode ? summaryQuery : rangeQuery;

  useEffect(() => {
    if (!modeSwapped.current) return;
    modeSwapped.current = false;
    resultsHeading.current?.focus();
  }, [rangeView]);

  function apply(next: FilterDraft, nextLimit = limit) {
    setApplied(next);
    setPage(1);
    setLimit(nextLimit);
    setSelectedKey(null);
  }

  function handleModeChange(mode: DateMode) {
    const dates = datesForMode(mode, draft);
    // A summary needs a window to aggregate over — Single has none.
    const summary = mode === "single" ? false : draft.summary;
    const next: FilterDraft = { ...draft, ...dates, mode, summary };
    modeSwapped.current = isRangeView(mode) !== isRangeView(applied.mode);
    setDraft(next);
    apply(next, RANGE_PAGE_SIZE);
  }

  function handleToggleSummary(summary: boolean) {
    const next: FilterDraft = { ...draft, summary };
    setDraft(next);
    apply(next);
  }

  function handleClear() {
    setDraft(baseline);
    apply(baseline, RANGE_PAGE_SIZE);
  }

  const rows: EmployeeRow[] = useMemo(() => {
    if (!rangeView) return [];
    const source = summaryMode ? summaryQuery.data?.data : rangeQuery.data?.data;
    if (!Array.isArray(source)) return [];
    return summaryMode
      ? source.map((row) => mapSummaryRow(row as SummaryReportRow))
      : source.map((row) => mapRangeReportRow(row as RangeReportRow));
  }, [rangeView, summaryMode, summaryQuery.data, rangeQuery.data]);

  const selected = useMemo(
    () => (selectedKey ? (rows.find((r) => r.key === selectedKey) ?? null) : null),
    [rows, selectedKey],
  );

  // The punch breakdown is fetched per-employee, only while a drawer is open. `/logs` is the
  // punch surface; a status-only day simply has no row here, which the drawer renders as its
  // own explicit empty line rather than as a failure.
  const punchQuery = usePunchBreakdown(
    { ...appliedFilters, userId: selected?.userId, name: undefined, page: 1, limit: 100 },
    !!selected,
  );

  /**
   * Graft the punch lists onto the open row's days.
   *
   * The day comes from the report (which can represent a timeless day) and only the punch list
   * comes from the log (which cannot) — so they are joined here, by date, rather than by asking
   * either endpoint for something it cannot answer.
   */
  const selectedWithPunches: EmployeeRow | null = useMemo(() => {
    if (!selected) return null;
    const logRow = punchQuery.data?.data?.find((entry) => entry.userId === selected.userId);
    const byDate = new Map(
      (logRow?.attendanceRecords ?? []).map((rec) => [rec.attendanceDate ?? "", rec.punches ?? []]),
    );
    return {
      ...selected,
      records: selected.records.map((rec) => ({
        ...rec,
        punches: rec.punches ?? byDate.get(rec.attendanceDate ?? "") ?? [],
      })),
    };
  }, [selected, punchQuery.data]);

  const pagination = summaryMode ? summaryQuery.data?.pagination : rangeQuery.data?.pagination;
  const totals = summaryMode ? summaryQuery.data?.totals : rangeQuery.data?.totals;
  const unreconciled = summaryMode
    ? summaryQuery.data?.unreconciled
    : rangeQuery.data?.unreconciled;

  const scopeLabel = describeScope(appliedFilters);
  const errorMessage =
    active.error instanceof ApiError
      ? active.error.message
      : active.error
        ? "Could not load attendance"
        : null;

  const singleDate = applied.date;

  return (
    <div className="flex flex-col gap-4" data-testid="office-staff-panel">
      <AttendanceLogFilterBar
        draft={draft}
        onDraftChange={setDraft}
        onModeChange={handleModeChange}
        onApply={() => apply(draft)}
        onClear={handleClear}
        onToggleSummary={handleToggleSummary}
        canSummarize={isRangeView(draft.mode)}
        showClear={hasActiveFilters(draft, baseline)}
        busy={active.isLoading}
      />

      {/* Header — one status, one pull, one push. No Export; no entry-source mode toggle. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2
            ref={resultsHeading}
            tabIndex={-1}
            aria-live="polite"
            className="text-[12.5px] font-semibold text-muted-foreground outline-none"
            data-testid="office-results-heading"
          >
            {rangeView ? "Logs & summary" : "Roster"} — {scopeLabel}
          </h2>
          {/* Export pointer — in place of the removed Export menu (spec §8). */}
          <p className="mt-0.5 text-[11.5px] text-muted-foreground" data-testid="attendance-export-pointer">
            Need a file?{" "}
            <Link href="/reports/hr" className="font-semibold text-accent-ink underline underline-offset-2">
              Download attendance from Reports › Attendance summary.
            </Link>
          </p>
        </div>
        <div className="flex items-center gap-2.5" data-testid="office-header-actions">
          <DeviceStatusBadge />
          <SyncDeviceButton onComplete={setLastRun} />
          <Button
            variant="outline"
            size="sm"
            onClick={() => setImportOpen(true)}
            title="Import attendance from a spreadsheet"
            data-testid="open-import"
          >
            <FileDown className="h-4 w-4" aria-hidden />
            Import
          </Button>
        </div>
      </div>

      {/*
        FR-HR-008a: a run that stores punches but reconciles NOTHING is never presented as a
        success. Persistent, focus-receiving, and it suppresses the success toast — a silent
        skip is the failure most easily mistaken for success, because its symptom (an employee
        reading absent every day, then PAID as absent) surfaces weeks later.
      */}
      <SkipReasonAlert
        reconciled={lastRun?.reconciled ?? 0}
        skippedReasons={lastRun?.skippedReasons ?? {}}
        onDismiss={() => setLastRun(null)}
      />

      {/*
        The report's own skipped-day guard. Days with punches but no reconciled row still render
        `Absent` below — this is what tells the reader not to trust that.
      */}
      {unreconciled && unreconciled.days > 0 ? (
        <SkipReasonAlert
          reconciled={0}
          skippedReasons={unreconciled.reasons}
          heading={`${unreconciled.days} day(s) in this period aren't in the reports.`}
          testId="unreconciled-alert"
        />
      ) : null}

      {!rangeView ? (
        /* Single date + project → the editable capture surface. */
        <OfficeRosterGrid date={singleDate} projectId={projectId} projects={projects} />
      ) : (
        <>
          {summaryMode && totals ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-7">
              <StatCard label="Employees" value={totals.totalEmployees} />
              <StatCard label="Working days" value={totals.workingDays} />
              <StatCard label="Present days" value={totals.presentCount} />
              <StatCard label="Late days" value={totals.lateCount} tone={totals.lateCount > 0 ? "danger" : "default"} />
              <StatCard label="Absent days" value={totals.absentCount} tone={totals.absentCount > 0 ? "danger" : "default"} />
              <StatCard label="Holidays" value={totals.holidayCount} tone="muted" />
              <StatCard label="Attendance" value={`${Math.round(totals.attendancePercentage)}%`} />
            </div>
          ) : null}

          <div className="rounded-card border border-border bg-surface">
            {errorMessage ? (
              <div role="alert" className="px-4 py-10 text-center">
                <p className="text-sm font-semibold text-destructive-ink">{errorMessage}</p>
                <button
                  type="button"
                  onClick={() => void active.refetch()}
                  className="mt-2 text-[12.5px] font-semibold text-accent-ink underline underline-offset-2"
                >
                  Try again
                </button>
              </div>
            ) : active.isLoading ? (
              <div className="flex flex-col gap-2 p-4" role="status" aria-live="polite">
                <span className="sr-only">Loading attendance</span>
                {Array.from({ length: 6 }, (_, i) => (
                  <Skeleton key={i} className="h-11 w-full" />
                ))}
              </div>
            ) : rows.length === 0 ? (
              <div className="p-4" data-testid="range-empty">
                {/* The review view never captures, so it offers NO add CTA (spec §6). */}
                <EmptyState
                  icon={Users}
                  title="No attendance recorded for this period."
                  description="Try a different period, or sync the device to pull the latest punches."
                />
              </div>
            ) : (
              <>
                <AttendanceLogTable
                  rows={rows}
                  isRangeView
                  page={page}
                  limit={limit}
                  selectable={!summaryMode}
                  onSelect={(row) => setSelectedKey(row.key)}
                />
                <AttendancePagination
                  page={pagination?.page ?? page}
                  limit={pagination?.limit ?? limit}
                  total={pagination?.total ?? rows.length}
                  totalPages={pagination?.totalPages ?? 1}
                  onPageChange={(next) => {
                    setPage(next);
                    setSelectedKey(null);
                  }}
                  onLimitChange={(next) => {
                    setLimit(next);
                    setPage(1);
                  }}
                  disabled={active.isFetching}
                />
              </>
            )}
          </div>

          <p className="text-[11.5px] text-muted-foreground" data-testid="range-readonly-note">
            Attendance is edited a day at a time — pick a single date to make changes.
          </p>
        </>
      )}

      <AttendanceDetailDrawer
        row={selectedWithPunches}
        scopeLabel={scopeLabel}
        onClose={() => setSelectedKey(null)}
      />

      <AttendanceImportDrawer open={importOpen} onClose={() => setImportOpen(false)} />
    </div>
  );
}
