"use client";

import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { AttendanceMeter } from "./AttendanceStats";
import { EmployeeAvatar } from "./EmployeeAvatar";
import {
  NO_DESIGNATION,
  UNNAMED,
  statusLabel,
  statusTone,
  type EmployeeRow,
} from "../lib/attendance-rows";
import { formatTime } from "../lib/attendance-time";

/**
 * The attendance table.
 *
 * Column layout is driven by `isRangeView`, which the parent derives from the **applied**
 * filters rather than the draft — so the headers always describe the rows actually on
 * screen, even while a new draft is being edited.
 *
 * Rows are buttons in spirit but `<tr>` in markup, so they carry an explicit tabindex and
 * key handler; they become inert in summary mode, where there is no per-day detail to open.
 */
export function AttendanceLogTable({
  rows,
  isRangeView,
  page,
  limit,
  onSelect,
  selectable,
}: {
  rows: EmployeeRow[];
  isRangeView: boolean;
  page: number;
  limit: number;
  onSelect: (row: EmployeeRow) => void;
  selectable: boolean;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[52px]">#</TableHead>
          <TableHead className="w-[104px]">User ID</TableHead>
          <TableHead>Name</TableHead>
          {isRangeView ? (
            <>
              <TableHead className="text-right">Working</TableHead>
              <TableHead className="text-right">Present</TableHead>
              <TableHead className="text-right">Late</TableHead>
              <TableHead className="text-right">Absent</TableHead>
              <TableHead className="text-right">Holidays</TableHead>
              <TableHead className="w-[132px]">Attendance %</TableHead>
            </>
          ) : (
            <>
              <TableHead className="w-[112px]">Status</TableHead>
              <TableHead className="w-[112px]">Check-in</TableHead>
              <TableHead className="w-[112px]">Check-out</TableHead>
            </>
          )}
        </TableRow>
      </TableHeader>

      <TableBody>
        {rows.map((row, index) => {
          // Continuous across pages, so row 21 on page 2 reads "21" not "01".
          const serial = String((page - 1) * limit + index + 1).padStart(2, "0");
          return (
            <TableRow
              key={row.key}
              tabIndex={selectable ? 0 : undefined}
              role={selectable ? "button" : undefined}
              aria-label={selectable ? `View attendance detail for ${row.name ?? row.userId}` : undefined}
              onClick={selectable ? () => onSelect(row) : undefined}
              onKeyDown={
                selectable
                  ? (e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onSelect(row);
                      }
                    }
                  : undefined
              }
              className={cn(
                selectable && "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
              )}
            >
              <TableCell className="text-[12px] tabular-nums text-faint">{serial}</TableCell>
              <TableCell className="font-mono text-[12.5px] text-muted-foreground">
                {row.userId}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2.5">
                  <EmployeeAvatar userId={row.userId} name={row.name} />
                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-semibold text-foreground">
                      {row.name?.trim() || UNNAMED}
                    </div>
                    <div className="truncate text-[11.5px] text-muted-foreground">
                      {row.designation?.trim() || NO_DESIGNATION}
                    </div>
                  </div>
                </div>
              </TableCell>

              {isRangeView ? (
                <>
                  <CountCell value={row.workingDays} />
                  <CountCell value={row.presentCount} />
                  <CountCell value={row.lateCount} tone="danger" />
                  <CountCell value={row.absentCount} tone="danger" />
                  <CountCell value={row.holidayCount} tone="muted" />
                  <TableCell>
                    <AttendanceMeter percent={row.attendancePercent} />
                  </TableCell>
                </>
              ) : (
                <>
                  <TableCell>
                    <Badge tone={statusTone(row.status)} dot>
                      {statusLabel(row.status)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-[12.5px] tabular-nums">
                    {formatTime(row.checkIn)}
                  </TableCell>
                  <TableCell className="text-[12.5px] tabular-nums">
                    {formatTime(row.checkOut)}
                  </TableCell>
                </>
              )}
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

/** A right-aligned count. Zero is de-emphasised so real numbers stand out when scanning. */
function CountCell({
  value,
  tone = "default",
}: {
  value: number;
  tone?: "default" | "danger" | "muted";
}) {
  const emphasised = value > 0;
  return (
    <TableCell
      className={cn(
        "text-right text-[12.5px] font-semibold tabular-nums",
        !emphasised && "text-faint",
        emphasised && tone === "danger" && "text-destructive-ink",
        emphasised && tone === "muted" && "text-muted-foreground",
        emphasised && tone === "default" && "text-foreground",
      )}
    >
      {value.toLocaleString()}
    </TableCell>
  );
}
