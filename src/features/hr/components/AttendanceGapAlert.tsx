"use client";

import { useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { AlertTriangle, ChevronRight } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { formatDayLabel } from "../lib/attendance-time";
import { type SalarySheetWarnings } from "../api/salary";
import { GAP_ALERT_COPY, skippedReasonLabel } from "../schemas/salary.schema";

/**
 * The FR-HR-013a pre-post attendance-gap warning (spec §5/§6/§8/§9/§10).
 *
 * A persistent `role="alert"` block ABOVE the lines table — never below, never a toast,
 * never ✕-dismissible. It renders from the sheet's STORED warnings so it reaches whoever
 * posts, not only whoever generated. Focus moves here on appearance: this run needs an
 * action, not just a notice.
 *
 * The acknowledgement checkbox is deliberately the LAST focusable element inside the
 * region (after the cross-link in DOM order it is not — so the checkbox is placed last in
 * the DOM and the cross-link before it), so a keyboard user reaches it only after tabbing
 * the whole list. The acknowledgement is per-session, never persisted, never transmitted —
 * the contract is explicit that warnings gate the client's post affordance only.
 */
export function AttendanceGapAlert({
  warnings,
  acknowledged,
  onAcknowledgedChange,
  resolveEmployee,
  attendanceHref,
  readOnly = false,
}: {
  warnings: SalarySheetWarnings;
  acknowledged: boolean;
  onAcknowledgedChange: (v: boolean) => void;
  /** employeeId → display name (Bangla-capable); falls back to the id when unknown. */
  resolveEmployee: (employeeId: string) => string;
  attendanceHref: string;
  /** Viewer without post/edit rights still sees the facts — only the checkbox hides. */
  readOnly?: boolean;
}) {
  const regionRef = useRef<HTMLDivElement>(null);

  // Focus the region when the alert appears (spec §10) — announced AND focused.
  useEffect(() => {
    regionRef.current?.focus();
  }, []);

  const unpaidRows = useMemo(
    () =>
      warnings.employeeAbsences
        .filter((a) => a.unpaidDays > 0)
        .sort((a, b) => b.unpaidDays - a.unpaidDays),
    [warnings.employeeAbsences],
  );

  return (
    <div
      ref={regionRef}
      role="alert"
      tabIndex={-1}
      className="mt-3.5 rounded-card border border-destructive/30 bg-destructive-soft p-4 focus:outline-none"
      data-testid="attendance-gap-alert"
    >
      <div className="flex gap-2.5">
        <AlertTriangle className="mt-0.5 h-4 w-4 flex-none text-destructive" aria-hidden />
        <div>
          <p className="text-[13.5px] font-bold text-destructive-ink">{GAP_ALERT_COPY.heading}</p>
          <p className="mt-0.5 text-[12.5px] text-destructive-ink/90">{GAP_ALERT_COPY.sub}</p>
        </div>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-3">
        {warnings.daysWithNoRecords.length > 0 ? (
          <section className="rounded-card border border-border bg-surface p-3.5" data-testid="gap-zero-record-days">
            <h3 className="text-[12.5px] font-bold text-foreground">
              {GAP_ALERT_COPY.zeroRecordHeading(warnings.daysWithNoRecords.length)}
            </h3>
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {warnings.daysWithNoRecords.map((d) => (
                <li
                  key={d}
                  className="rounded-token border border-destructive/40 bg-destructive-soft px-2 py-0.5 font-mono text-[12px] font-semibold tabular-nums text-destructive-ink"
                >
                  {formatDayLabel(d)}
                </li>
              ))}
            </ul>
            <p className="mt-2.5 text-[11.5px] text-muted-foreground">{GAP_ALERT_COPY.zeroRecordTrailing}</p>
          </section>
        ) : null}

        {unpaidRows.length > 0 ? (
          <section className="rounded-card border border-border bg-surface p-3.5" data-testid="gap-unpaid-by-employee">
            <h3 className="text-[12.5px] font-bold text-foreground">{GAP_ALERT_COPY.unpaidHeading}</h3>
            <ul className="mt-2 flex flex-col gap-1">
              {unpaidRows.map((row) => (
                <li
                  key={row.employeeId}
                  className="flex items-baseline justify-between gap-3 text-[12.5px]"
                >
                  {/* Bangla-capable full-width row — wraps, never clips (spec §12). */}
                  <span className="min-w-0 [overflow-wrap:anywhere] text-foreground">
                    {resolveEmployee(row.employeeId)}
                  </span>
                  <span className="flex-none font-semibold text-destructive-ink">
                    <span className="font-mono tabular-nums">{row.unpaidDays}</span> unpaid day(s)
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-2.5 text-[11.5px] text-muted-foreground">{GAP_ALERT_COPY.unpaidTrailing}</p>
          </section>
        ) : null}

        {warnings.skippedEmployees.length > 0 ? (
          <section className="rounded-card border border-border bg-surface p-3.5" data-testid="gap-skipped-employees">
            <h3 className="text-[12.5px] font-bold text-foreground">
              {GAP_ALERT_COPY.skippedHeading(warnings.skippedEmployees.length)}
            </h3>
            <ul className="mt-2 flex flex-col gap-1">
              {warnings.skippedEmployees.map((row) => (
                <li key={row.employeeId} className="text-[12.5px] [overflow-wrap:anywhere]">
                  <span className="text-foreground">{resolveEmployee(row.employeeId)}</span>{" "}
                  <span className="font-semibold text-destructive-ink">
                    — {skippedReasonLabel(row.reason)}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-2.5 text-[11.5px] text-muted-foreground">{GAP_ALERT_COPY.skippedTrailing}</p>
          </section>
        ) : null}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <Link
          href={attendanceHref}
          className="order-1 inline-flex h-9 items-center gap-1 rounded-token border border-destructive/40 bg-surface px-3 text-[12.5px] font-semibold text-destructive-ink transition-colors hover:bg-destructive-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:order-2"
          data-testid="gap-attendance-link"
        >
          {GAP_ALERT_COPY.crossLink}
          <ChevronRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
        {/* The checkbox is the LAST focusable element in the region (spec §10) — it sits
            after the cross-link in DOM order; the visual order swaps via CSS order. */}
        {!readOnly ? (
          <label className="order-2 hidden cursor-pointer items-center gap-2.5 sm:order-1 md:flex">
            <Checkbox
              checked={acknowledged}
              onChange={(e) => onAcknowledgedChange(e.target.checked)}
              data-testid="gap-acknowledge"
            />
            <span className="text-[12.5px] font-semibold text-destructive-ink">
              {GAP_ALERT_COPY.acknowledgement}
            </span>
          </label>
        ) : null}
      </div>

      {/* Mobile: acknowledge is a desk task (spec §4). */}
      <p className="mt-2 text-[11.5px] text-muted-foreground md:hidden">
        Acknowledge and post from a desktop.
      </p>
    </div>
  );
}
