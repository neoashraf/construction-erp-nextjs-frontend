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
  statusLabel,
  statusTone,
  type EmployeeRow,
} from "../lib/attendance-rows";
import { formatDayLabel, formatTimeWithSeconds } from "../lib/attendance-time";

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
              {row.records.map((record) => {
                const isHoliday = record.status === "Holiday" || Boolean(record.holidayName);
                return (
                  <li
                    key={record.id}
                    className="flex items-center justify-between gap-3 rounded-token border border-border bg-surface px-3 py-2.5"
                  >
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
                  </li>
                );
              })}
            </ul>
          )}
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}
