"use client";

import { Badge } from "@/components/ui/badge";
import { ReportGeneratedAt } from "../../components/ReportGeneratedAt";
import {
  AttendancePercentCell,
  EmptyBody,
  ErrorBody,
  IdleBody,
  InactiveTag,
  LoadingBody,
  NameUnavailable,
} from "./shared";
import { ATTENDANCE_TOTALS_ID, AttendanceTotalsBand } from "./AttendanceTotalsBand";
import {
  type AttendanceReportTotals,
  type AttendanceSummaryRow,
} from "../types";

/**
 * FE-66 **Summary** level — the registered monthly roll-up (FR-RPT-026).
 *
 * Nine columns: Project · Employee / Party · Cost centre · Present · Paid leave ·
 * Unpaid leave · Absent · Head count · Attendance %. A row keys on employee,
 * subcontractor party, or a cost-centre daily-labour head count — render
 * whichever resolves.
 *
 * Two FE-66 changes to what FE-60 shipped:
 *   • **Project is a column**, so the grain is legible in one grid rather than
 *     via interleaved group bands (the design's frame 1).
 *   • **The `Month totals` `<tfoot>` is gone.** Totals now render in the
 *     `Report totals` band ABOVE the table (`AttendanceTotalsBand`), because the
 *     figure is the server's over the whole filtered set, not a footer summing
 *     the rows the page happens to be showing.
 *
 * **Responsive (spec §4, §11).** Below 1024 the four day-count columns collapse
 * into one `Attendance` cell (present / leave / absent stacked) and Cost centre
 * moves to the identity cell's second line — but only *visually*: every
 * `<th scope="col">` and its cells stay in the markup, hidden with `sr-only`
 * rather than `hidden`, so assistive tech still reads present / paid leave /
 * unpaid leave / absent / cost centre per row at every width (spec §10).
 */
export function AttendanceSummaryTable({
  rows,
  totals,
  generatedAt,
  isLoading,
  isError,
  onRetry,
  emptyLabel,
}: {
  rows: AttendanceSummaryRow[] | undefined;
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

  // The column renders only where the endpoint serves the figure — never computed.
  const showPercent = rows.some((r) => r.attendancePercentage !== null);

  return (
    <div data-testid="hr-att-table">
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
                <th scope="col" className="h-11 px-2.5 lg:px-4 text-left font-semibold">Project</th>
                <th scope="col" className="h-11 px-2.5 lg:px-4 text-left font-semibold">Employee / Party</th>
                <th scope="col" className="h-11 px-2.5 lg:px-4 text-left font-semibold max-lg:sr-only">
                  Cost centre
                </th>
                {/*
                  Below 1024 this header reads "Attendance" and the next three
                  are visually hidden — but they stay in the markup with
                  `scope="col"`, so assistive tech still reads present / paid
                  leave / unpaid leave / absent per row at every width (spec §10).
                  `sr-only` (not `hidden`) is what keeps them announced.
                */}
                <th scope="col" className="h-11 px-2.5 lg:px-4 text-right font-semibold max-lg:text-left">
                  <span aria-hidden className="lg:hidden">Attendance</span>
                  <span className="max-lg:sr-only">Present</span>
                </th>
                <th scope="col" className="h-11 px-2.5 lg:px-4 text-right font-semibold max-lg:sr-only">
                  Paid leave
                </th>
                <th scope="col" className="h-11 px-2.5 lg:px-4 text-right font-semibold max-lg:sr-only">
                  Unpaid leave
                </th>
                <th scope="col" className="h-11 px-2.5 lg:px-4 text-right font-semibold max-lg:sr-only">
                  Absent
                </th>
                <th scope="col" className="h-11 px-2.5 lg:px-4 text-right font-semibold">Head count</th>
                {showPercent && (
                  <th scope="col" className="h-11 px-2.5 lg:px-4 text-right font-semibold">
                    Attendance %
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr
                  key={`${r.projectId}-${r.employeeId ?? r.partyId ?? r.costCentreId}-${i}`}
                  className="border-b border-border/60 hover:bg-canvas/60"
                  data-testid="hr-att-row"
                >
                  <td className="max-w-[200px] px-2.5 py-2.5 lg:px-4 align-middle">
                    {r.projectName ?? <NameUnavailable id={r.projectId ?? "—"} />}
                  </td>
                  <td className="max-w-[240px] px-2.5 py-2.5 lg:px-4">
                    <RowIdentity row={r} />
                    {/*
                      Below 1024 the Cost centre column collapses into this cell
                      as the row's second line (the design's 768 frame). The real
                      column keeps its own `<td>` — hidden visually, still read —
                      so this copy is `aria-hidden` and never announced twice.
                    */}
                    <div
                      className="mt-0.5 hidden text-[11px] text-muted-foreground max-lg:block"
                      aria-hidden
                    >
                      {r.costCentreName ?? r.costCentreCode ?? "—"}
                    </div>
                  </td>
                  <td className="max-w-[200px] px-2.5 py-2.5 lg:px-4 max-lg:sr-only">
                    {r.costCentreName ? (
                      <>
                        <span className="font-medium">
                          {r.costCentreCode}
                          <span className="mx-1 text-muted-foreground">·</span>
                          {r.costCentreName}
                        </span>
                        {r.costCentreInactive && <InactiveTag />}
                      </>
                    ) : (
                      <NameUnavailable id={r.costCentreCode ?? r.costCentreId ?? "—"} />
                    )}
                  </td>
                  {/* Below 1024 these four stack into the single visual cell the
                      design's tablet frame shows; the cells themselves persist. */}
                  <td className="px-2.5 py-2.5 lg:px-4 text-right font-semibold tabular-nums text-success-ink max-lg:text-left">
                    <span className="lg:hidden">Present </span>
                    {r.present}
                    <span className="hidden text-[11.5px] font-normal text-muted-foreground max-lg:mt-0.5 max-lg:block">
                      Leave {r.paidLeave} paid / {r.unpaidLeave} unpaid
                    </span>
                    <span className="hidden text-[11.5px] font-normal text-destructive max-lg:block">
                      Absent {r.absent}
                    </span>
                  </td>
                  <td className="px-2.5 py-2.5 lg:px-4 text-right tabular-nums max-lg:sr-only">
                    {r.paidLeave}
                  </td>
                  <td className="px-2.5 py-2.5 lg:px-4 text-right tabular-nums max-lg:sr-only">
                    {r.unpaidLeave}
                  </td>
                  <td className="px-2.5 py-2.5 lg:px-4 text-right tabular-nums max-lg:sr-only">{r.absent}</td>
                  <td className="px-2.5 py-2.5 lg:px-4 text-right tabular-nums">{r.headCount}</td>
                  {showPercent && (
                    <td className="px-2.5 py-2.5 lg:px-4 text-right">
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

/** Office → employee, subcontractor → party, daily labour → an unnamed head count. */
function RowIdentity({ row: r }: { row: AttendanceSummaryRow }) {
  return (
    <>
      {r.mode === "OFFICE" &&
        (r.employeeName ? (
          <>
            {r.employeeName}
            {r.employeeInactive && <InactiveTag />}
          </>
        ) : (
          <NameUnavailable id={r.employeeId ?? "—"} />
        ))}
      {r.mode === "SUBCONTRACTOR" && (r.partyName ?? <NameUnavailable id={r.partyId ?? "—"} />)}
      {r.mode === "DAILY_LABOUR" && (
        <span className="italic text-muted-foreground">No named person</span>
      )}
      <div className="mt-0.5">
        <Badge tone={r.mode === "SUBCONTRACTOR" ? "accent" : r.mode === "DAILY_LABOUR" ? "warning" : "info"}>
          {r.mode === "OFFICE" ? "Employee" : r.mode === "SUBCONTRACTOR" ? "Party" : "Daily labour"}
        </Badge>
      </div>
    </>
  );
}
