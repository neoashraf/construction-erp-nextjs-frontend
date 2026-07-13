import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  confirmDailyLabour,
  reverseDailyLabour,
  type DailyLabourConfirmInput,
  type DailyLabourReverseInput,
} from "../api/attendance";

/**
 * Daily-labour Confirm/Reverse hook (FR-HR-009..-012, -018). Confirm is deliberately
 * non-optimistic — the caller shows a per-row "Posting…" state until the server responds
 * with the balanced accrual result (posted `entryNo`, `accruedAmount`). Reverse is
 * reason-required and produces a linked reversal entry; the original stays locked.
 * `retry:false` — never re-fire a failed post; the row surfaces the mapped error.
 */
export function useDailyLabourConfirm() {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["hr", "attendance", "list"] });
  };

  const confirm = useMutation({
    mutationFn: ({ id, input }: { id: string; input: DailyLabourConfirmInput }) =>
      confirmDailyLabour(id, input),
    onSuccess: invalidate,
    retry: false,
  });

  const reverse = useMutation({
    mutationFn: ({ id, input }: { id: string; input: DailyLabourReverseInput }) =>
      reverseDailyLabour(id, input),
    onSuccess: invalidate,
    retry: false,
  });

  return { confirm, reverse };
}
