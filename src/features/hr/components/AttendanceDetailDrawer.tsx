"use client";

import { CalendarOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Sheet, SheetBody, SheetContent, SheetHeader } from "@/components/ui/sheet";
import { AttendanceMeter, StatCard } from "./AttendanceStats";
import { EmployeeAvatar } from "./EmployeeAvatar";
import {
  NO_DESIGNATION,
  UNNAMED,
  sourceBadgeLabel,
  sourceBadgeTone,
  statusLabel,
  statusTone,
  type EmployeeRow,
} from "../lib/attendance-rows";
import { statusDisplayLabel } from "../schemas/attendance.schema";
import { type AttendanceDayRecord, type AttendancePunch } from "../api/attendance-logs";
import { formatDayLabel, formatTime, formatTimeWithSeconds } from "../lib/attendance-time";

/** The location shown for a punch that states none of its own (a machine states no place). */
const OFFICE_FALLBACK = "Head office";

/**
 * Day-by-day detail for one employee.
 *
 * Mounted only while a row is selected, so the table stays light when nothing is open.
 * The row is passed by reference from the currently loaded page, which means a background
 * refresh (a sync, a filter change) flows straight through — the drawer shows live data
 * rather than a snapshot taken at open time.
 *
 * Radix's Dialog primitive (via `Sheet`) supplies the focus trap, Escape handling, body
 * scroll-lock, backdrop dismissal and `role="dialog"` + `aria-modal`, so none of that is
 * re-implemented here.
 */
export function AttendanceDetailDrawer({
  row,
  scopeLabel,
  onClose,
}: {
  row: EmployeeRow | null;
  scopeLabel: string;
  onClose: () => void;
}) {
  if (!row) return null;

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        aria-label={`Attendance detail for ${row.name ?? row.userId}`}
        className="w-[520px]"
      >
        <SheetHeader
          kicker={scopeLabel}
          title={
            <span className="flex items-center gap-2.5">
              <EmployeeAvatar userId={row.userId} name={row.name} />
              <span className="min-w-0">
                <span className="block truncate">{row.name?.trim() || UNNAMED}</span>
                <span className="block truncate text-[11.5px] font-medium text-muted-foreground">
                  {row.designation?.trim() || NO_DESIGNATION}
                </span>
              </span>
            </span>
          }
        />

        <SheetBody>
          <div className="mb-1 flex items-center gap-2">
            <span className="rounded-pill bg-muted px-2 py-0.5 font-mono text-[11.5px] font-semibold text-muted-foreground">
              {row.userId}
            </span>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2">
            <StatCard label="Working" value={row.workingDays} />
            <StatCard label="Present" value={row.presentCount} />
            <StatCard label="Late" value={row.lateCount} tone={row.lateCount > 0 ? "danger" : "default"} />
            <StatCard label="Absent" value={row.absentCount} tone={row.absentCount > 0 ? "danger" : "default"} />
            <StatCard label="Holidays" value={row.holidayCount} tone="muted" />
            <div className="rounded-card border border-border bg-surface px-3 py-2.5">
              <div className="text-[10.5px] font-semibold uppercase tracking-[0.5px] text-faint">
                Attendance
              </div>
              <div className="mt-1.5">
                <AttendanceMeter percent={row.attendancePercent} />
              </div>
            </div>
          </div>

          <h3 className="mb-2 mt-5 text-[11px] font-semibold uppercase tracking-[0.5px] text-faint">
            Daily records
          </h3>

          {row.records.length === 0 ? (
            <EmptyState
              icon={CalendarOff}
              title="No attendance records in this date range"
              description="Records appear here once the device has been synced for these dates."
            />
          ) : (
            <ul className="flex flex-col gap-1.5">
              {row.records.map((record) => (
                <DayCard key={record.id} record={record} dayLocation={row.dayLocation} />
              ))}
            </ul>
          )}

          {row.records.length > 0 ? (
            <p className="mt-3 text-[11.5px] leading-relaxed text-muted-foreground">
              Punches are the provenance of a merged day — read-only. Two places in one day is a
              fact, not a conflict.
            </p>
          ) : null}
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}

/**
 * One day: the reconciled header (from `attendance_record`) plus its punch breakdown
 * (from `GET /logs`). The two come from different surfaces on purpose — see below.
 */
function DayCard({
  record,
  dayLocation,
}: {
  record: AttendanceDayRecord;
  dayLocation?: string | null;
}) {
  const isHoliday = record.status === "Holiday" || Boolean(record.holidayName);
  const punches = record.punches ?? [];
  const status = statusDisplayLabel(record.status);

  return (
    <li className="rounded-token border border-border bg-surface">
      <div className="flex items-center justify-between gap-3 px-3 py-2.5">
        <div className="min-w-0">
          <div className="text-[12.5px] font-semibold tabular-nums text-foreground">
            {formatDayLabel(record.attendanceDate ?? record.deviceTimestamp)}
          </div>
          {isHoliday ? (
            <div className="truncate text-[11.5px] text-muted-foreground">
              {record.holidayName || "Holiday"}
            </div>
          ) : (
            <div className="text-[11.5px] tabular-nums text-muted-foreground">
              In {formatTimeWithSeconds(record.checkInAt ?? record.occurredAt ?? record.deviceTimestamp)}
              {" · "}
              Out {formatTimeWithSeconds(record.checkOutAt)}
            </div>
          )}
        </div>
        <Badge tone={statusTone(record.status)} dot className="flex-none">
          {statusLabel(record.status)}
        </Badge>
      </div>

      {isHoliday ? null : punches.length === 0 ? (
        /*
          A day with a STATUS and no punches is the FR-HR-004 second-branch day — an approved
          PAID_LEAVE or an ABSENT day has no times to punch. It must never render as an empty
          list, a spinner or a retry prompt: all three read as a load failure and invite the
          user to retry something that is already correct. The day header above is authoritative;
          the punch list simply has nothing to add (spec §6/§8).
        */
        <div
          className="border-t border-border px-3 py-2.5"
          data-testid="punch-breakdown-empty"
        >
          <p className="text-[11.5px] italic leading-relaxed text-muted-foreground">
            No punches recorded — entered manually.
          </p>
          <p className="mt-0.5 text-[11.5px] leading-relaxed text-faint">
            This day was recorded as {status} without times.
          </p>
        </div>
      ) : (
        /*
          A semantic table, not a styled list (spec §10) — a screen-reader user has to be able
          to compare punches column-wise. Read-only provenance: there is deliberately NO "keep
          this one" control anywhere, because nothing is in conflict. The office-at-09:00 plus
          site-at-14:00 case is a merge to be SEEN, not resolved (SRS §12 edges 9, 15).
        */
        <div className="border-t border-border px-3 py-2">
          <table className="w-full border-collapse text-[11.5px]" data-testid="punch-breakdown">
            <caption className="sr-only">
              Punches that merged into this day — time, location and how each reached us
            </caption>
            <thead className="sr-only">
              <tr>
                <th scope="col">Time</th>
                <th scope="col">Location</th>
                <th scope="col">Source</th>
              </tr>
            </thead>
            <tbody>
              {punches.map((punch, i) => (
                <tr key={`${punch.time}-${i}`} data-testid="punch-row">
                  <td className="whitespace-nowrap py-1 pr-2 align-top font-mono tabular-nums text-foreground">
                    {formatPunchTime(punch.time)}
                  </td>
                  {/* Bangla site names must wrap, never clip, and never push time/source out of view. */}
                  <td className="w-full py-1 pr-2 align-top text-muted-foreground [overflow-wrap:anywhere]">
                    {punchLocation(punch, dayLocation)}
                  </td>
                  <td className="py-1 align-top text-right">
                    <Badge tone={sourceBadgeTone(punch.sourceType)} className="flex-none">
                      {sourceBadgeLabel(punch.sourceType)}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </li>
  );
}

/**
 * Where a punch happened.
 *
 * `projectName` is the location stated on the PUNCH ITSELF — rank 1, and always present on a
 * `MANUAL` punch (the Location picker is required) and on an `EXCEL_IMPORT` punch whose sheet
 * row supplied a resolvable location. A device punch always carries `null`, because a machine
 * states no place; that falls back to the day's resolved location, and finally to the literal
 * "Head office" (spec §5).
 */
function punchLocation(punch: AttendancePunch, dayLocation?: string | null): string {
  return punch.projectName?.trim() || dayLocation?.trim() || OFFICE_FALLBACK;
}

/** `09:00:00` → `09:00`. The punch list wants the clock, not the seconds. */
function formatPunchTime(time: string): string {
  const trimmed = (time ?? "").trim();
  const match = /^(\d{1,2}):(\d{2})/.exec(trimmed);
  if (match) return `${match[1]!.padStart(2, "0")}:${match[2]}`;
  return formatTime(trimmed) || trimmed;
}
