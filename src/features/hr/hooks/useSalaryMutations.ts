import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  applyBulkComponents,
  generateSalarySheet,
  postSalarySheet,
  reverseSalarySheet,
  updateSalaryLine,
  type BulkComponentInput,
  type GenerateSheetInput,
  type PostSalaryInput,
  type ReverseSalaryInput,
  type SalaryLineUpdateInput,
} from "../api/salary";

/**
 * Salary-sheet write mutations (FR-HR-013..-018). Every mutation invalidates the list
 * subtree + (where relevant) the detail so the editor reconciles to server state.
 * `retry:false` — never re-fire a Post/Reverse; those are ledger-touching. Generate is
 * likewise never retried (the server's `DUPLICATE_DRAFT_SHEET` is the truth).
 */
export function useSalaryMutations(sheetId?: string) {
  const qc = useQueryClient();
  const invalidateList = () => {
    qc.invalidateQueries({ queryKey: ["hr", "salary-sheets", "list"] });
  };
  const invalidateSheet = () => {
    if (sheetId) {
      qc.invalidateQueries({ queryKey: ["hr", "salary-sheet", "detail", sheetId] });
    }
    invalidateList();
  };

  const generate = useMutation({
    mutationFn: (input: GenerateSheetInput) => generateSalarySheet(input),
    onSuccess: invalidateList,
    retry: false,
  });

  const patchLine = useMutation({
    mutationFn: ({ lineId, input }: { lineId: string; input: SalaryLineUpdateInput }) =>
      updateSalaryLine(sheetId!, lineId, input),
    onSuccess: invalidateSheet,
    retry: false,
  });

  const applyBulk = useMutation({
    mutationFn: (input: BulkComponentInput) => applyBulkComponents(sheetId!, input),
    onSuccess: invalidateSheet,
    retry: false,
  });

  const post = useMutation({
    mutationFn: (input: PostSalaryInput) => postSalarySheet(sheetId!, input),
    onSuccess: invalidateSheet,
    retry: false,
  });

  const reverse = useMutation({
    mutationFn: (input: ReverseSalaryInput) => reverseSalarySheet(sheetId!, input),
    onSuccess: invalidateSheet,
    retry: false,
  });

  return { generate, patchLine, applyBulk, post, reverse };
}
