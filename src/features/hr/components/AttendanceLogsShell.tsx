"use client";

import { useMemo, useState } from "react";
import { FileDown, Users } from "lucide-react";
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
import { ExportMenu } from "./ExportMenu";
import { SyncDeviceButton } from "./SyncDeviceButton";
import { type LogEntry, type SummaryReportRow } from "../api/attendance-logs";
import { useAttendanceLogs, useAttendanceSummary } from "../hooks/useAttendanceLogs";
import { mapLogEntry, mapSummaryRow, type EmployeeRow } from "../lib/attendance-rows";
import {
  DEFAULT_PAGE_SIZE,
  RANGE_PAGE_SIZE,
  datesForMode,
  hasActiveFilters,
  initialDraft,
  isRangeView,
  suggestedExportType,
  toRequestFilters,
  type DateMode,
  type FilterDraft,
} from "../lib/attendance-filters";
import { describeScope } from "../lib/attendance-time";

/**
 * Biometric attendance logs.
 *
 * State is split in two on purpose: `draft` is what the user is editing, `applied` is what
 * was actually fetched. Everything the table renders — its columns, its labels, the export
 * scope — derives from `applied`, so the screen never describes rows it hasn't got.
 *
 * Mode changes and the Summary toggle deliberately commit straight to `applied`: both
 * change the table's shape, and applying the dates lazily would leave aggregate columns
 * over a date-less query (which the server answers with "today", showing one working day
 * for everyone).
 */
export function AttendanceLogsShell() {
  const [baseline] = useState(() => initialDraft());
  const [draft, setDraft] = useState<FilterDraft>(baseline);
  const [applied, setApplied] = useState<FilterDraft>(baseline);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(RANGE_PAGE_SIZE);
  // Only the key is held — the row itself is resolved from the live page below, so a
  // background refresh flows into the open drawer instead of freezing it at open time.
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const appliedFilters = useMemo(() => toRequestFilters(applied), [applied]);
  const rangeView = isRangeView(applied.mode);
  const summaryMode = applied.summary;

  const query = { ...appliedFilters, page, limit };
  const logsQuery = useAttendanceLogs(query, !summaryMode);
  const summaryQuery = useAttendanceSummary(query, summaryMode);

  const active = summaryMode ? summaryQuery : logsQuery;

  /** Commit a draft and reset paging — any filter change invalidates the current offset. */
  function apply(next: FilterDraft, nextLimit = limit) {
    setApplied(next);
    setPage(1);
    setLimit(nextLimit);
    setSelectedKey(null);
  }

  function handleModeChange(mode: DateMode) {
    // Resolve the dates the mode implies now, so the applied query is never date-less.
    const dates = datesForMode(mode, draft);
    // A summary needs a window to aggregate over — Single has none.
    const summary = mode === "single" ? false : draft.summary;
    const next: FilterDraft = { ...draft, ...dates, mode, summary };
    setDraft(next);
    apply(next, mode === "single" ? DEFAULT_PAGE_SIZE : RANGE_PAGE_SIZE);
  }

  function handleToggleSummary(summary: boolean) {
    // Re-apply the current draft alongside the toggle so it takes effect on this click
    // rather than the next Apply.
    const next: FilterDraft = { ...draft, summary };
    setDraft(next);
    apply(next);
  }

  function handleClear() {
    setDraft(baseline);
    apply(baseline, RANGE_PAGE_SIZE);
  }

  const rows: EmployeeRow[] = useMemo(() => {
    // The api bindings already normalise `data` to an array; the Array.isArray guard is a
    // second line of defence so a malformed payload can never turn into a render crash.
    const source = summaryMode ? summaryQuery.data?.data : logsQuery.data?.data;
    if (!Array.isArray(source)) return [];
    return summaryMode
      ? source.map((row) => mapSummaryRow(row as SummaryReportRow))
      : source.map((row) => mapLogEntry(row as LogEntry));
  }, [summaryMode, summaryQuery.data, logsQuery.data]);

  // Resolve the open row from the current page rather than storing a copy, so a sync or
  // refetch updates the drawer in place. A row that vanishes from the page closes it.
  const selected = useMemo(
    () => (selectedKey ? (rows.find((r) => r.key === selectedKey) ?? null) : null),
    [rows, selectedKey],
  );

  const pagination = summaryMode ? summaryQuery.data?.pagination : logsQuery.data?.pagination;
  const totals = summaryQuery.data?.totals;

  const scopeLabel = describeScope(appliedFilters);
  const errorMessage =
    active.error instanceof ApiError
      ? active.error.message
      : active.error
        ? "Could not load attendance"
        : null;

  return (
    <div className="flex flex-col gap-4" data-testid="attendance-logs">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-[23px] font-bold tracking-[-0.02em]">Attendance logs</h1>
          <span className="inline-flex h-[23px] items-center whitespace-nowrap rounded-pill bg-muted px-2.5 text-[11.5px] font-semibold text-muted-foreground">
            {scopeLabel}
          </span>
          <DeviceStatusBadge />
        </div>
        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setImportOpen(true)}
            title="Import attendance from a spreadsheet"
            data-testid="open-import"
          >
            {/*
              FileDown / FileUp rather than Upload / Download: the latter pair share an
              identical tray path and differ only by a flipped 5px arrowhead, so side by side
              at 16px Import and Export read as the same button twice. The document outline
              distinguishes them at a glance, and is literally what both actions move.

              Import points DOWN and Export points UP — data coming INTO the table vs leaving
              it. The pair must stay opposite; matching arrows defeats the whole point of
              choosing a directional icon.
            */}
            <FileDown className="h-4 w-4" aria-hidden />
            Import
          </Button>
          <SyncDeviceButton />
          <ExportMenu
            filters={appliedFilters}
            suggested={suggestedExportType(applied.mode, summaryMode)}
            disabled={active.isLoading}
          />
        </div>
      </div>

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

      {/* Summary strip — only in summary mode, where the API returns totals */}
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

      {/* Table */}
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
          <div className="p-4">
            <EmptyState
              icon={Users}
              title="No attendance found"
              description="No employees matched these filters. Try a different period, or sync the device to pull the latest punches."
            />
          </div>
        ) : (
          <>
            <AttendanceLogTable
              rows={rows}
              isRangeView={rangeView}
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

      <AttendanceDetailDrawer
        row={selected}
        scopeLabel={scopeLabel}
        onClose={() => setSelectedKey(null)}
      />

      <AttendanceImportDrawer open={importOpen} onClose={() => setImportOpen(false)} />
    </div>
  );
}
