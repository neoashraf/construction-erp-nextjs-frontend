"use client";

import Link from "next/link";
import { Info } from "lucide-react";
import { Card } from "@/components/ui/card";

/**
 * FE-66 — the ≤375 fallback frame (spec §4; the comp's mobile artboard).
 *
 * HR reports are a monthly **review** of payroll-sensitive figures with wide
 * tables and file exports, so this report is scoped desktop/tablet-only — unlike
 * the attendance *capture* screens, which are genuine on-site flows. Rather than
 * squeeze a nine-column roll-up onto a phone, the phone frame states the limit
 * and points at the screen that does serve the on-site question.
 *
 * **No Export is offered here.** A file downloaded to a phone is not the task
 * this report exists for, and the design frame deliberately omits it.
 */
export function AttendanceMobileNotice() {
  return (
    <Card className="p-4" data-testid="hr-att-mobile-notice">
      <div className="flex gap-3">
        <span
          className="mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-full bg-info-soft"
          aria-hidden
        >
          <Info className="h-3.5 w-3.5 text-info-ink" />
        </span>
        <div className="space-y-2">
          <h2 className="text-[14px] font-bold text-foreground">
            Best viewed on desktop or tablet
          </h2>
          <p className="text-[12.5px] leading-relaxed text-muted-foreground">
            HR reports are a monthly review of payroll-sensitive figures with wide tables and file
            exports. Open this on a desktop or tablet to run and export it.
          </p>
          <p className="text-[12.5px] leading-relaxed text-muted-foreground">
            Need today&rsquo;s attendance on site? Use{" "}
            <Link
              href="/hr/attendance"
              className="font-semibold text-accent-ink underline underline-offset-2"
            >
              Attendance capture
            </Link>{" "}
            — it shows the same figures this report totals.
          </p>
        </div>
      </div>
    </Card>
  );
}
