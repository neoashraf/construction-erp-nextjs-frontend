import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createGovernmentHoliday,
  deleteGovernmentHoliday,
  getWeeklyOffDays,
  importGovernmentHolidays,
  importHolidaysFromRows,
  listGovernmentHolidays,
  saveWeeklyOffDays,
  type GovernmentHoliday,
  type ImportHolidayRow,
} from "../api/holidays";

/**
 * Holiday-calendar hooks.
 *
 * Every mutation here invalidates the attendance-log caches as well as the holiday list:
 * changing a weekly off-day or a dated holiday retroactively changes how many working days
 * each employee had, so leaving the log rows cached would show counts that silently
 * disagree with the calendar that produced them.
 */

export const holidayKeys = {
  weekly: () => ["hr", "holidays", "weekly"] as const,
  government: (year: number) => ["hr", "holidays", "government", year] as const,
};

/** Invalidate everything a calendar change can affect. */
function useInvalidateCalendar() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ["hr", "holidays"] });
    queryClient.invalidateQueries({ queryKey: ["hr", "attendance-logs"] });
    queryClient.invalidateQueries({ queryKey: ["hr", "attendance-summary"] });
  };
}

export function useWeeklyOffDays() {
  return useQuery({
    queryKey: holidayKeys.weekly(),
    queryFn: getWeeklyOffDays,
    staleTime: 5 * 60 * 1000,
  });
}

export function useSaveWeeklyOffDays() {
  const invalidate = useInvalidateCalendar();
  return useMutation({
    mutationFn: (weekdays: number[]) => saveWeeklyOffDays(weekdays),
    onSuccess: invalidate,
  });
}

export function useGovernmentHolidays(year: number) {
  return useQuery({
    queryKey: holidayKeys.government(year),
    queryFn: () => listGovernmentHolidays(year),
    staleTime: 5 * 60 * 1000,
  });
}

/** Sort holidays by date ascending — applied after every local cache write. */
function byDate(a: GovernmentHoliday, b: GovernmentHoliday): number {
  return a.date.localeCompare(b.date);
}

/**
 * Create or update a holiday.
 *
 * The backend upserts by date, so the response may be an update of an existing row. The
 * cache is written directly (replacing any entry with the same date, then re-sorting)
 * rather than refetched — a full refetch would flash the whole table for a single-row edit.
 * Attendance caches are still invalidated, since the counts really do change.
 */
export function useSaveHoliday(year: number) {
  const queryClient = useQueryClient();
  const invalidateAttendance = useInvalidateCalendar();
  return useMutation({
    mutationFn: createGovernmentHoliday,
    onSuccess: (holiday) => {
      queryClient.setQueryData<GovernmentHoliday[]>(holidayKeys.government(year), (prev) => {
        const rest = (prev ?? []).filter((h) => h.date !== holiday.date);
        return [...rest, holiday].sort(byDate);
      });
      invalidateAttendance();
    },
  });
}

export function useDeleteHoliday(year: number) {
  const queryClient = useQueryClient();
  const invalidateAttendance = useInvalidateCalendar();
  return useMutation({
    mutationFn: (id: string) => deleteGovernmentHoliday(id),
    onSuccess: (_void, id) => {
      queryClient.setQueryData<GovernmentHoliday[]>(holidayKeys.government(year), (prev) =>
        (prev ?? []).filter((h) => h.id !== id),
      );
      invalidateAttendance();
    },
  });
}

/** Replace the year's list with the upstream government calendar. */
export function useImportGovernmentHolidays(year: number) {
  const queryClient = useQueryClient();
  const invalidateAttendance = useInvalidateCalendar();
  return useMutation({
    mutationFn: () => importGovernmentHolidays(year),
    onSuccess: (holidays) => {
      queryClient.setQueryData(holidayKeys.government(year), [...holidays].sort(byDate));
      invalidateAttendance();
    },
  });
}

/**
 * Merge spreadsheet rows into the year's calendar.
 *
 * Merge is keyed by date with the imported row winning, then filtered to the selected year
 * — a workbook covering several years must not leak other years' rows into this view.
 */
export function useImportHolidayRows(year: number) {
  const queryClient = useQueryClient();
  const invalidateAttendance = useInvalidateCalendar();
  return useMutation({
    mutationFn: (rows: ImportHolidayRow[]) => importHolidaysFromRows(rows),
    onSuccess: (result) => {
      queryClient.setQueryData<GovernmentHoliday[]>(holidayKeys.government(year), (prev) => {
        const merged = new Map<string, GovernmentHoliday>();
        for (const h of prev ?? []) merged.set(h.date, h);
        for (const h of result.holidays) merged.set(h.date, h);
        return [...merged.values()]
          .filter((h) => h.date.startsWith(String(year)))
          .sort(byDate);
      });
      invalidateAttendance();
    },
  });
}
