import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";
import { useAuthenticatedUser } from "@/providers/session-provider";
import {
  getCompany,
  updateCompanyIdentity,
  updateLocalization,
  type UpdateCompanyIdentityInput,
  type UpdateLocalizationInput,
} from "../api/company";

/** The single company record, keyed by the session's companyId (FR-MAS-001). */
export function useCompany() {
  const user = useAuthenticatedUser();
  return useQuery({
    queryKey: queryKeys.detail("master-data", "company", user.companyId),
    queryFn: () => getCompany(user.companyId),
  });
}

/** PATCH company identity; invalidates the company detail on success (FR-MAS-004/032). */
export function useUpdateCompanyIdentity() {
  const user = useAuthenticatedUser();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateCompanyIdentityInput) => updateCompanyIdentity(user.companyId, input),
    onSuccess: () =>
      qc.invalidateQueries({
        queryKey: queryKeys.detail("master-data", "company", user.companyId),
      }),
    retry: false,
  });
}

/** PUT company localization; invalidates the company detail on success (FR-MAS-004/032). */
export function useUpdateLocalization() {
  const user = useAuthenticatedUser();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateLocalizationInput) => updateLocalization(user.companyId, input),
    onSuccess: () =>
      qc.invalidateQueries({
        queryKey: queryKeys.detail("master-data", "company", user.companyId),
      }),
    retry: false,
  });
}
