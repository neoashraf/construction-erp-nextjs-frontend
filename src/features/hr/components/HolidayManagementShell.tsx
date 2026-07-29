"use client";

import { useSession } from "@/providers/session-provider";
import { canManageHolidays } from "../access";
import { HolidayCalendarPanel } from "./HolidayCalendarPanel";
import { WeeklyOffDaysPanel } from "./WeeklyOffDaysPanel";

/**
 * `/hr/holidays` — weekly off-days plus the dated holiday calendar (FR-HR-008d).
 *
 * Both panels feed the same working-day maths behind attendance AND — under FR-HR-013a —
 * `paid_days` on every MONTHLY salary line, which is why the subtitle states the payroll
 * consequence: it is the only place a user is told these settings reach pay. Each panel
 * invalidates the attendance caches on save (see `useHolidays`); no cross-panel wiring is
 * needed here.
 *
 * A viewer without the `hr.attendance` write grants sees the screen read-only — every
 * write affordance hidden, one explanatory line. The server re-checks every route
 * regardless (defence-in-depth, not the gate).
 */
export function HolidayManagementShell() {
  const session = useSession();
  const readOnly = !(session && canManageHolidays(session));

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4" data-testid="holiday-management">
      <div>
        <h1 className="mt-1 text-[23px] font-bold tracking-[-0.02em]">Holidays</h1>
        <p className="mt-0.5 max-w-[92ch] text-[12.5px] text-muted-foreground">
          Weekly off-days and the holiday calendar decide which days count as working days —
          and, since holidays are paid days inside the monthly baseline, what a monthly
          employee is paid.
        </p>
        {readOnly ? (
          <p className="mt-1 text-[12.5px] text-muted-foreground" data-testid="holidays-read-only">
            You can view the holiday calendar but not change it.
          </p>
        ) : null}
      </div>

      <WeeklyOffDaysPanel readOnly={readOnly} />
      <HolidayCalendarPanel readOnly={readOnly} />
    </div>
  );
}
