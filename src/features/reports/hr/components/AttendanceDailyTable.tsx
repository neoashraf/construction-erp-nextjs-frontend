"use client";

import {
  AttendanceSourceBadge,
  AttendanceStatusPill,
  ddMmYyyy,
  EmptyBody,
  ErrorBody,
  IdleBody,
  LoadingBody,
  NameUnavailable,
} from "./shared";
import { ReportGeneratedAt } from "../../components/ReportGeneratedAt";
import { ATTENDANCE_TOTALS_ID, AttendanceTotalsBand } from "./AttendanceTotalsBand";
import { type AttendanceDailyRow, type AttendanceReportTotals } from "../types";

/**
 * FE-66 **Daily** level — one row per **employee-day** (spec §4, §5).
 *
 * Eight columns: Employee · Date · Location · Check-in · Check-out · Status ·
 * Punches · Source. **No day counts and no Attendance % at this grain** — a
 * percentage over a single employee-day is not a meaningful figure.
 *
 * The load-bearing behaviour here is the **timeless day**: a row carrying a
 * status but no times (`Paid leave`, `Absent`, `Weekly holiday`, a government
 * holiday) renders **blank time cells with the status intact**. That is an
 * expected shape, not a data gap — it is precisely the day FR-HR-013a deducts
 * pay for, so dropping it or flagging it as an error would hide the days that
 * cost someone money (spec §6, §13).
 *
 * `Punches` is the count only. The punch-level breakdown is deliberately absent:
 * it belongs to the capture screen's day drawer (`GET /api/logs`), not to any
 * report level.
 */
export function AttendanceDailyTable({
  rows,
  totals,
  generatedAt,
  isLoading,
  isError,
  onRetry,
  emptyLabel,
}: {
  rows: AttendanceDailyRow[] | undefined;
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

  return (
    <div data-testid="hr-att-daily-table">
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
                <th scope="col" className="h-11 px-4 text-left font-semibold">Date</th>
                <th scope="col" className="h-11 px-4 text-left font-semibold">Location</th>
                {/*
                  Below 1024 the time columns fold into the Date cell (spec §11).
                  They stay in the markup as `sr-only` rather than being removed,
                  so a screen-reader user still gets check-in / check-out per row
                  — including the blank pair that marks a leave day.
                */}
                <th scope="col" className="h-11 px-4 text-right font-semibold max-lg:sr-only">
                  Check-in
                </th>
                <th scope="col" className="h-11 px-4 text-right font-semibold max-lg:sr-only">
                  Check-out
                </th>
                <th scope="col" className="h-11 px-4 text-left font-semibold">Status</th>
                <th scope="col" className="h-11 px-4 text-right font-semibold max-lg:sr-only">
                  Punches
                </th>
                <th scope="col" className="h-11 px-4 text-left font-semibold">Source</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={`${r.userId}-${r.attendanceDate}-${r.id}`}
                  className="border-b border-border/60 hover:bg-canvas/60"
                  data-testid="hr-att-daily-row"
                >
                  {/* Bangla names wrap, never clip — and never at the cost of
                      pushing the time columns out of view (spec §12). */}
                  <td className="max-w-[220px] px-4 py-2.5 align-middle">
                    {r.name ?? <NameUnavailable id={r.userId || "—"} />}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 tabular-nums">
                    {r.attendanceDate ? ddMmYyyy(r.attendanceDate) : "—"}
                    {/* The folded times below 1024; `aria-hidden` because the real
                        cells remain in the row and are what AT reads. */}
                    <span
                      className="mt-0.5 hidden text-[11.5px] text-muted-foreground max-lg:block"
                      aria-hidden
                    >
                      {r.checkIn || r.checkOut
                        ? `${r.checkIn ?? "—"} → ${r.checkOut ?? "—"} · ${r.punchCount} punches`
                        : "No punches"}
                    </span>
                  </td>
                  <td className="max-w-[260px] px-4 py-2.5 text-muted-foreground">
                    {r.locationName ?? "—"}
                  </td>
                  {/*
                    A timeless day leaves these genuinely blank. Rendering a dash
                    or a zero here would assert something the server did not say.
                  */}
                  <td
                    className="px-4 py-2.5 text-right tabular-nums max-lg:sr-only"
                    data-testid="hr-att-daily-checkin"
                  >
                    {r.checkIn ?? ""}
                  </td>
                  <td
                    className="px-4 py-2.5 text-right tabular-nums max-lg:sr-only"
                    data-testid="hr-att-daily-checkout"
                  >
                    {r.checkOut ?? ""}
                  </td>
                  <td className="px-4 py-2.5">
                    <AttendanceStatusPill
                      status={
                        r.status === "Holiday" && r.holidayName
                          ? holidayLabel(r.holidayName)
                          : r.status
                      }
                    />
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground max-lg:sr-only">
                    {r.punchCount}
                  </td>
                  <td className="px-4 py-2.5">
                    <AttendanceSourceBadge label={r.sourceLabel} />
                  </td>
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

/**
 * A government holiday overrides a weekly one on the same date, so the report can
 * name the real holiday rather than a generic weekend label (FR-HR-013a).
 */
function holidayLabel(name: string): string {
  return /^(friday|saturday|sunday|weekly)/i.test(name)
    ? "Weekly holiday"
    : `Government holiday — ${name}`;
}
