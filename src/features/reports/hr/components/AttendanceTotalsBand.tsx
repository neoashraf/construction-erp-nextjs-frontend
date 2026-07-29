"use client";

import { type AttendanceReportTotals } from "../types";

export const ATTENDANCE_TOTALS_ID = "hr-att-report-totals";

/**
 * FE-66 — the **`Report totals`** band (spec §5, §10).
 *
 * Two things make this different from the FE-60 `Month totals` `<tfoot>` it
 * replaces:
 *
 * 1. **It is the server's figure over the whole filtered set, never a sum of the
 *    visible page.** `totals` is computed server-side while only `data` is sliced
 *    (contract 12 § "Totals vs pagination"). A caller that has no server totals
 *    passes `null` and this renders **nothing** — the band is never synthesised.
 * 2. **It sits above the table**, between the result header and the column
 *    headers, so the totals and the Export control are both reachable without
 *    scrolling past a long result (spec §4). It stays in reading order rather
 *    than floating, and every attendance table points at it via
 *    `aria-describedby={ATTENDANCE_TOTALS_ID}` so the figures are announced as
 *    the table's summary.
 */
export function AttendanceTotalsBand({ totals }: { totals: AttendanceReportTotals | null }) {
  // No server totals → no band. A wrong number is worse than a missing one.
  if (!totals) return null;

  return (
    <div
      id={ATTENDANCE_TOTALS_ID}
      className="border-b border-border bg-accent-soft/35 px-4 py-3"
      data-testid="hr-att-totals-band"
    >
      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1.5">
        <span className="text-[11px] font-bold uppercase tracking-wide text-accent-ink">
          Report totals
        </span>
        <Figure label="Present" value={totals.present} tone="success" />
        <Figure label="Paid leave" value={totals.paidLeave} />
        <Figure label="Unpaid leave" value={totals.unpaidLeave} />
        <Figure label="Absent" value={totals.absent} tone="destructive" />
        {totals.attendancePercentage !== null && (
          <Figure label="Attendance" value={`${totals.attendancePercentage}%`} />
        )}
      </div>
      <p className="mt-1.5 text-right text-[11px] text-muted-foreground">
        {totals.scopeNote ? `${totals.scopeNote} · ` : ""}
        Server-side totals over the whole result set — not a sum of this page.
      </p>
    </div>
  );
}

function Figure({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
  tone?: "success" | "destructive";
}) {
  return (
    <span className="text-[12.5px] text-muted-foreground">
      {label}{" "}
      <strong
        className={
          tone === "success"
            ? "tabular-nums text-success-ink"
            : tone === "destructive"
              ? "tabular-nums text-destructive"
              : "tabular-nums text-foreground"
        }
      >
        {value}
      </strong>
    </span>
  );
}
