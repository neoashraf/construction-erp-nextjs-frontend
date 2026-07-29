"use client";

import {
  AttendancePercentCell,
  EmptyBody,
  ErrorBody,
  IdleBody,
  InactiveTag,
  LoadingBody,
  NameUnavailable,
} from "./shared";
import { ReportGeneratedAt } from "../../components/ReportGeneratedAt";
import { ATTENDANCE_TOTALS_ID, AttendanceTotalsBand } from "./AttendanceTotalsBand";
import { type AttendanceRangeRow, type AttendanceReportTotals } from "../types";

/**
 * FE-66 **Range** level — per-employee day counts over an arbitrary window
 * (spec §4, §5). Eight columns: Employee · Project · Cost centre · Present ·
 * Paid leave · Unpaid leave · Absent · Attendance %.
 *
 * The exportable twin of the capture screen's on-screen range view — same
 * numbers, plus a file (FR-RPT-004). The range end is clamped to today
 * server-side, so a future date cannot manufacture absences; the panel carries
 * that note.
 *
 * `Attendance %` is the server's `attendancePercentage` rendered verbatim. The
 * column is **omitted entirely** when no row carries one — absent rather than
 * fabricated, because the FE never divides anything.
 */
export function AttendanceRangeTable({
  rows,
  totals,
  generatedAt,
  isLoading,
  isError,
  onRetry,
  emptyLabel,
}: {
  rows: AttendanceRangeRow[] | undefined;
  totals: AttendanceReportTotals | null;
  generatedAt?: string;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  emptyLabel: string;
}) {
  if (isLoading) return <LoadingBody testid="hr-att-loading" />;
  if (isError) {
    return (
      <ErrorBody
        title="Couldn't load the attendance summary."
        onRetry={onRetry}
        testid="hr-att-error"
        retryTestid="hr-att-retry"
      />
    );
  }
  if (!rows) return <IdleBody testid="hr-att-idle" />;

  // Render the column only where the API actually serves the figure.
  const showPercent = rows.some((r) => r.attendancePercentage !== null);

  return (
    <div data-testid="hr-att-range-table">
      <AttendanceTotalsBand totals={totals} />
      {rows.length === 0 ? (
        <EmptyBody label={emptyLabel} testid="hr-att-empty" />
      ) : (
        <div className="overflow-x-auto">
          <table
            className="w-full border-collapse text-[13px]"
            aria-describedby={totals ? ATTENDANCE_TOTALS_ID : undefined}
          >
            <thead>
              <tr className="border-b border-border bg-canvas text-[11px] uppercase tracking-wide text-muted-foreground">
                <th scope="col" className="h-11 px-4 text-left font-semibold">Employee</th>
                <th scope="col" className="h-11 px-4 text-left font-semibold">Project</th>
                <th scope="col" className="h-11 px-4 text-left font-semibold">Cost centre</th>
                <th scope="col" className="h-11 px-4 text-right font-semibold">Present</th>
                <th scope="col" className="h-11 px-4 text-right font-semibold">Paid leave</th>
                <th scope="col" className="h-11 px-4 text-right font-semibold">Unpaid leave</th>
                <th scope="col" className="h-11 px-4 text-right font-semibold">Absent</th>
                {showPercent && (
                  <th scope="col" className="h-11 px-4 text-right font-semibold">
                    Attendance %
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={`${r.userId}-${r.id}`}
                  className="border-b border-border/60 hover:bg-canvas/60"
                  data-testid="hr-att-range-row"
                >
                  <td className="max-w-[240px] px-4 py-2.5">
                    {r.name ?? <NameUnavailable id={r.userId || "—"} />}
                    {r.employeeInactive && <InactiveTag />}
                  </td>
                  <td className="max-w-[220px] px-4 py-2.5 text-muted-foreground">
                    {r.projectName ?? "—"}
                  </td>
                  <td className="max-w-[200px] px-4 py-2.5 text-muted-foreground">
                    {r.costCentreName ?? "—"}
                  </td>
                  <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-success-ink">
                    {r.present}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{r.paidLeave}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{r.unpaidLeave}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{r.absent}</td>
                  {showPercent && (
                    <td className="px-4 py-2.5 text-right">
                      {r.attendancePercentage !== null ? (
                        <AttendancePercentCell value={r.attendancePercentage} />
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {generatedAt && (
        <div className="px-6 pb-4 pt-3">
          <ReportGeneratedAt generatedAt={generatedAt} />
        </div>
      )}
    </div>
  );
}
