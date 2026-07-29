"use client";

import Link from "next/link";
import { Alert } from "@/components/ui/alert";
import { NO_WEEKLY_HOLIDAYS_COPY } from "../schemas/salary.schema";

/**
 * `warnings.noWeeklyHolidaysConfigured` banner (FR-HR-013a; SRS §8/§16).
 *
 * Rendered ABOVE the attendance-gap block because it invalidates everything the gap block
 * reports: with no weekly holidays configured every weekend counts as an unpaid working
 * day, so the day list and the per-employee counts below are all inflated. It is the one
 * payroll defect the report-vs-payroll cross-check cannot catch — both sides read the
 * same empty config and agree — and a brand-new tenant lands in it without touching a
 * setting.
 *
 * No comp coverage (see the brief's ambiguity note) — built from the design-system
 * `Alert` defaults: warning tone, full width, never dismissible.
 */
export function NoWeeklyHolidaysWarning() {
  return (
    <Alert
      tone="warning"
      className="mt-3.5"
      title={NO_WEEKLY_HOLIDAYS_COPY.title}
      data-testid="no-weekly-holidays-warning"
    >
      <p>
        {NO_WEEKLY_HOLIDAYS_COPY.body}{" "}
        <Link
          href="/hr/holidays"
          className="font-semibold text-warning-ink underline underline-offset-2"
        >
          Open Holidays
        </Link>
      </p>
    </Alert>
  );
}
