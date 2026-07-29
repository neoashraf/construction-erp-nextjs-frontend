"use client";

import { useEffect, useRef } from "react";
import { AlertTriangle, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The FR-HR-008a skip warning — **persistent, never a toast**.
 *
 * A sync or import that stores punches but folds **no** employee-day into `attendance_record`
 * must not be presented as a success. That is not a UI preference: the symptom of a silent skip
 * is an employee reading as absent every day and then being *paid* as absent under FR-HR-013a,
 * with a server log line as the only other signal — a failure that surfaces weeks later, in the
 * payroll run, as money.
 *
 * So when `reconciled === 0` and `skippedReasons` is non-empty this renders **instead of** the
 * success toast, takes focus (the run needs an action, not just a notice), and stays until
 * dismissed. A partial run — some days folded, some skipped — shows both the counts and the
 * reasons, and does not steal focus, because nothing is blocked.
 *
 * Each reason is rendered as **something the user can do**, never as the raw server code: a
 * `<ul>` of real list items so counts and reasons read as discrete units to a screen reader
 * (spec §8/§9/§10).
 */

/** Server skip code → the plain-language action (spec §8). */
const REASON_LABEL: Record<string, string> = {
  UNKNOWN_EMPLOYEE_CODE: "Employee code not recognised",
  NO_PROJECT: "No location set — set a default location on the device or on the employee",
  NO_FINANCIAL_YEAR: "No financial year covers these dates",
  ALREADY_CONFIRMED: "Day already confirmed — a confirmed day is never overwritten",
};

/** An unlisted code still reads as words, never as `SOME_RAW_CODE`. */
export function humanizeSkipCode(code: string): string {
  return REASON_LABEL[code] ?? code.toLowerCase().replace(/_/g, " ");
}

export function SkipReasonAlert({
  reconciled,
  skippedReasons,
  heading,
  onDismiss,
  testId = "skip-reason-alert",
}: {
  reconciled: number;
  skippedReasons: Record<string, number>;
  /** Overrides the default heading (used by the report's `unreconciled` guard). */
  heading?: string;
  onDismiss?: () => void;
  testId?: string;
}) {
  const entries = Object.entries(skippedReasons).filter(([, count]) => count > 0);
  const skipped = entries.reduce((sum, [, count]) => sum + count, 0);
  const blocking = reconciled === 0 && skipped > 0;

  const region = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // Focus only when NOTHING reconciled — that run needs an action. A partial run is a notice.
    if (blocking) region.current?.focus();
  }, [blocking, skipped]);

  if (skipped === 0) return null;

  return (
    <div
      ref={region}
      role="alert"
      tabIndex={-1}
      className={cn("rounded-card border border-warning/40 bg-warning-soft px-3.5 py-3 outline-none")}
      data-testid={testId}
    >
      <div className="flex items-start gap-2.5">
        <AlertTriangle className="mt-0.5 h-4 w-4 flex-none text-warning-ink" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-[12.5px] font-semibold text-warning-ink">
            {heading ??
              (blocking
                ? `${skipped} punches were stored, but no attendance day was updated.`
                : `${reconciled} days updated · ${skipped} skipped.`)}
          </p>
          <p className="mt-0.5 text-[11.5px] leading-relaxed text-warning-ink/85">
            {blocking
              ? "Until this is fixed, these days won't appear in attendance or on a salary sheet."
              : "Nothing to resolve here; fix the cause and re-import — re-importing what already landed changes nothing."}
          </p>

          <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.4px] text-warning-ink/80">
            Why days were skipped
          </p>
          <ul className="mt-1 flex flex-col gap-1" data-testid="skip-reason-list">
            {entries.map(([code, count]) => (
              <li key={code} className="text-[11.5px] leading-relaxed text-warning-ink">
                {count} × {humanizeSkipCode(code)}
              </li>
            ))}
          </ul>
        </div>
        {onDismiss ? (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss the skipped-punches warning"
            className="flex-none rounded-sm p-1 text-warning-ink/70 transition-colors hover:text-warning-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
          </button>
        ) : null}
      </div>
    </div>
  );
}
