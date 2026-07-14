import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";
import { useAuthenticatedUser } from "@/providers/session-provider";
import {
  findExistingOpening,
  getOpeningPreview,
  postOpeningJournal,
  type OpeningPostBody,
} from "../api/opening";

/**
 * Opening-wizard queries + post mutation (spec §6/§9; FR-GEN-009…-015). Two
 * independent queries: the preview (assembled lines) and the existing-OPENING check.
 * When an OPENING voucher already exists the wizard renders the recap; otherwise it
 * shows the derived preview + the single Post action.
 */
export function useOpeningAssembly() {
  const user = useAuthenticatedUser();
  const scope = { companyId: user.companyId, financialYearId: user.financialYearId };
  return {
    preview: useQuery({
      queryKey: queryKeys.list("contra-journal", "opening-preview", scope, {}),
      queryFn: () => getOpeningPreview(),
      retry: false,
    }),
    existing: useQuery({
      queryKey: queryKeys.list("contra-journal", "opening-existing", scope, {}),
      queryFn: () => findExistingOpening(),
      retry: false,
    }),
  };
}

export function useOpeningPost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: OpeningPostBody) => postOpeningJournal(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["contra-journal"] }),
    retry: false,
  });
}
