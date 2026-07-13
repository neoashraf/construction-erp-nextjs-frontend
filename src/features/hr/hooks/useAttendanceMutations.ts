import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  importOfficeBiometric,
  saveDailyLabourAttendance,
  saveOfficeAttendance,
  saveSubcontractorAttendance,
  updateDailyLabour,
  type DailyLabourRowInput,
  type DailyLabourUpdateInput,
  type OfficeAttendanceRow,
  type SubcontractorRow,
} from "../api/attendance";

/**
 * Attendance write mutations (FR-HR-004..-008). Every mutation invalidates the attendance
 * list so the UI reconciles to server state. `retry:false` — non-idempotent writes. Confirm
 * / Reverse live in `useDailyLabourConfirm` because they are the accrual post/reverse
 * lifecycle and want independent inflight tracking per-row.
 */
export function useAttendanceMutations() {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["hr", "attendance", "list"] });
  };

  const saveOffice = useMutation({
    mutationFn: (rows: OfficeAttendanceRow[]) => saveOfficeAttendance(rows),
    onSuccess: invalidate,
    retry: false,
  });

  const importOffice = useMutation({
    mutationFn: (feed: OfficeAttendanceRow[]) => importOfficeBiometric(feed),
    onSuccess: invalidate,
    retry: false,
  });

  const saveSubcontractor = useMutation({
    mutationFn: (rows: SubcontractorRow[]) => saveSubcontractorAttendance(rows),
    onSuccess: invalidate,
    retry: false,
  });

  const saveDailyLabour = useMutation({
    mutationFn: (rows: DailyLabourRowInput[]) => saveDailyLabourAttendance(rows),
    onSuccess: invalidate,
    retry: false,
  });

  const patchDailyLabour = useMutation({
    mutationFn: ({ id, input }: { id: string; input: DailyLabourUpdateInput }) =>
      updateDailyLabour(id, input),
    onSuccess: invalidate,
    retry: false,
  });

  return { saveOffice, importOffice, saveSubcontractor, saveDailyLabour, patchDailyLabour };
}
