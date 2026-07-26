"use client";

import { Breadcrumb } from "@/components/ui/breadcrumb";
import { HolidayCalendarPanel } from "./HolidayCalendarPanel";
import { WeeklyOffDaysPanel } from "./WeeklyOffDaysPanel";

/**
 * `/hr/holidays` — weekly off-days plus the dated holiday calendar.
 *
 * Both panels feed the same working-day maths behind the attendance logs, so each one
 * invalidates the attendance caches on save (see `useHolidays`); no cross-panel wiring is
 * needed here.
 */
export function HolidayManagementShell() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4" data-testid="holiday-management">
      <div>
        <Breadcrumb items={[{ label: "HR" }, { label: "Holidays" }]} />
        <h1 className="mt-1 text-[23px] font-bold tracking-[-0.02em]">Holiday management</h1>
        <p className="mt-0.5 text-[12.5px] text-muted-foreground">
          Weekly off-days and the holiday calendar determine which days count as working days
          in attendance reports.
        </p>
      </div>

      <WeeklyOffDaysPanel />
      <HolidayCalendarPanel />
    </div>
  );
}
