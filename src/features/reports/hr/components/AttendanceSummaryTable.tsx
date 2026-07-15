"use client";

import { Badge } from "@/components/ui/badge";
import { ReportGeneratedAt } from "../../components/ReportGeneratedAt";
import { EmptyBody, ErrorBody, IdleBody, InactiveTag, LoadingBody, NameUnavailable } from "./shared";
import { type AttendanceSummaryRow, type AttendanceTotals } from "../types";

/**
 * FE-60 Attendance summary body (FR-RPT-026). Rows grouped by project (project
 * header + head-count pill); a row keys on employee, subcontractor party, or
 * cost-centre daily-labour — render whichever resolves.
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
  totals: AttendanceTotals | null;
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
  if (rows.length === 0) return <EmptyBody label={emptyLabel} testid="hr-att-empty" />;

  const grouped = groupByProject(rows);
  const captionId = "hr-att-caption";
  return (
    <div data-testid="hr-att-table">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[13px]" aria-describedby={captionId}>
          <thead>
            <tr className="border-b border-border bg-canvas text-[11px] uppercase tracking-wide text-muted-foreground">
              <th scope="col" className="h-11 px-4 text-left font-semibold">Employee / Party</th>
              <th scope="col" className="h-11 px-4 text-left font-semibold">Cost centre</th>
              <th scope="col" className="h-11 px-4 text-right font-semibold">Present</th>
              <th scope="col" className="h-11 px-4 text-right font-semibold">Paid leave</th>
              <th scope="col" className="h-11 px-4 text-right font-semibold">Unpaid leave</th>
              <th scope="col" className="h-11 px-4 text-right font-semibold">Absent</th>
              <th scope="col" className="h-11 px-4 text-right font-semibold">Head count</th>
            </tr>
          </thead>
          <tbody>
            {grouped.map((g) => (
              <ProjectGroup key={g.projectId} group={g} />
            ))}
          </tbody>
          {totals && (
            <tfoot>
              <tr
                className="border-t-2 border-foreground/70 bg-success-soft text-[13px] font-bold text-success-ink"
                data-testid="hr-att-totals-footer"
              >
                <td colSpan={2} className="px-4 py-3">Month totals</td>
                <td className="px-4 py-3 text-right tabular-nums">{totals.present}</td>
                <td className="px-4 py-3 text-right tabular-nums">{totals.paidLeave}</td>
                <td className="px-4 py-3 text-right tabular-nums">{totals.unpaidLeave}</td>
                <td className="px-4 py-3 text-right tabular-nums">{totals.absent}</td>
                <td className="px-4 py-3 text-right tabular-nums">{totals.headCount}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      {generatedAt && (
        <div className="px-6 pb-4 pt-3">
          <ReportGeneratedAt generatedAt={generatedAt} id={captionId} />
        </div>
      )}
    </div>
  );
}

interface Group {
  projectId: string;
  projectName: string | null;
  rows: AttendanceSummaryRow[];
  headCount: number;
}

function groupByProject(rows: AttendanceSummaryRow[]): Group[] {
  const map = new Map<string, Group>();
  for (const r of rows) {
    const id = r.projectId ?? "__unknown__";
    let g = map.get(id);
    if (!g) {
      g = { projectId: id, projectName: r.projectName ?? null, rows: [], headCount: 0 };
      map.set(id, g);
    }
    g.rows.push(r);
    g.headCount += r.headCount;
  }
  return Array.from(map.values());
}

function ProjectGroup({ group }: { group: Group }) {
  return (
    <>
      <tr className="bg-canvas/70" data-testid="hr-att-project-band">
        <td colSpan={6} className="px-4 py-2 text-[12px] font-semibold text-foreground">
          {group.projectName ?? <NameUnavailable id={group.projectId} />}
        </td>
        <td className="px-4 py-2 text-right">
          <Badge tone="info">Head count {group.headCount}</Badge>
        </td>
      </tr>
      {group.rows.map((r, i) => (
        <tr
          key={`${r.projectId}-${r.employeeId ?? r.partyId ?? r.costCentreId}-${i}`}
          className="border-b border-border/60 hover:bg-canvas/60"
          data-testid="hr-att-row"
        >
          <td className="px-4 py-2.5">
            {r.mode === "OFFICE" && (r.employeeName ? (
              <>
                {r.employeeName}
                {r.employeeInactive && <InactiveTag />}
              </>
            ) : (
              <NameUnavailable id={r.employeeId ?? "—"} />
            ))}
            {r.mode === "SUBCONTRACTOR" && (r.partyName ?? <NameUnavailable id={r.partyId ?? "—"} />)}
            {r.mode === "DAILY_LABOUR" && (
              <span className="text-muted-foreground italic">Daily labour head-count</span>
            )}
            <div className="mt-0.5 text-[10.5px] uppercase tracking-wide text-muted-foreground">
              {r.mode.replace("_", " ").toLowerCase()}
            </div>
          </td>
          <td className="px-4 py-2.5">
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
          <td className="px-4 py-2.5 text-right tabular-nums">{r.present}</td>
          <td className="px-4 py-2.5 text-right tabular-nums">{r.paidLeave}</td>
          <td className="px-4 py-2.5 text-right tabular-nums">{r.unpaidLeave}</td>
          <td className="px-4 py-2.5 text-right tabular-nums">{r.absent}</td>
          <td className="px-4 py-2.5 text-right tabular-nums">{r.headCount}</td>
        </tr>
      ))}
    </>
  );
}
